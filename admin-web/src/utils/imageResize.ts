/**
 * Browser-side image downscale + re-encode, run on every admin image before it is uploaded.
 *
 * The catalogue is loaded from phone photos (4000 px / 3-5 MB each); shipping those bytes to a
 * mobile product tile is the exact performance problem the R2 migration exists to fix. Every
 * selected file is therefore decoded, EXIF-rotated, scaled so its longest edge is at most
 * `maxEdge`, and re-encoded (WebP where the browser can encode it, otherwise JPEG/PNG) before
 * it leaves the browser.
 *
 * Nothing here throws. Any failure — a format canvas cannot decode (HEIC), a missing encoder,
 * a browser without `createImageBitmap` — resolves to the untouched original so the upload
 * still happens; the caller uploads whatever `file` comes back.
 */

/** Longest edge of the re-encoded image, in CSS pixels. Smaller images are never upscaled. */
export const DEFAULT_MAX_EDGE = 1600;

/** Lossy encoder quality for WebP / JPEG output. */
export const DEFAULT_QUALITY = 0.82;

/**
 * Formats that are uploaded byte-for-byte: canvas would rasterise vectors, drop GIF
 * animation, or (for AVIF) re-encode an already-efficient file into a larger one.
 */
const PASSTHROUGH_TYPES = ['image/svg+xml', 'image/gif', 'image/avif'];

export interface ResizeImageOptions {
  /** Longest-edge cap in pixels. Defaults to {@link DEFAULT_MAX_EDGE}. */
  maxEdge?: number;
  /** Encoder quality (0-1) for lossy output. Defaults to {@link DEFAULT_QUALITY}. */
  quality?: number;
  /**
   * Output encoding. `'auto'` (default) prefers WebP and falls back to JPEG/PNG. Pin an explicit
   * type for consumers whose endpoint expects one format — the payment-proof base64 field, say.
   */
  outputType?: 'auto' | 'image/webp' | 'image/jpeg' | 'image/png';
}

export interface ResizedImageResult {
  /** The file to upload: the re-encoded one, or the untouched original when processing was skipped. */
  file: File;
  /** False when the original is being uploaded as-is (unsupported format, decode failure, or the re-encode came out larger). */
  didProcess: boolean;
  originalSizeBytes: number;
  sizeBytes: number;
  /** Output pixel dimensions — only present when `didProcess` is true. */
  width?: number;
  height?: number;
}

let webpEncodeSupport: boolean | null = null;

/** Whether `canvas.toBlob`/`toDataURL` can actually emit WebP (Safari < 14 silently emits PNG). */
const canEncodeWebP = (): boolean => {
  if (webpEncodeSupport !== null) return webpEncodeSupport;
  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    webpEncodeSupport = probe.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpEncodeSupport = false;
  }
  return webpEncodeSupport;
};

/**
 * Reads the EXIF `Orientation` tag (0x0112) out of a JPEG's APP1 segment.
 *
 * Only the first 128 KB is inspected — EXIF always sits at the head of the file — and any
 * malformed structure resolves to 1 ("already upright") rather than throwing.
 */
const readExifOrientation = async (file: File): Promise<number> => {
  try {
    if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') return 1;
    const buffer = await file.slice(0, 128 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return 1;

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if ((marker & 0xff00) !== 0xff00) break;
      // SOS / EOI: compressed data starts here, EXIF cannot follow.
      if (marker === 0xffda || marker === 0xffd9) break;

      const segmentSize = view.getUint16(offset, false);
      if (segmentSize < 2) break;

      if (marker === 0xffe1) {
        // APP1 must carry the "Exif" signature before the TIFF header.
        if (offset + 8 > view.byteLength || view.getUint32(offset + 2, false) !== 0x45786966) {
          offset += segmentSize;
          continue;
        }
        const tiff = offset + 8;
        if (tiff + 8 > view.byteLength) return 1;
        const littleEndian = view.getUint16(tiff, false) === 0x4949;
        let dir = tiff + view.getUint32(tiff + 4, littleEndian);
        if (dir + 2 > view.byteLength) return 1;
        const entryCount = view.getUint16(dir, littleEndian);
        dir += 2;
        for (let i = 0; i < entryCount; i++) {
          const entry = dir + i * 12;
          if (entry + 12 > view.byteLength) break;
          if (view.getUint16(entry, littleEndian) === 0x0112) {
            const value = view.getUint16(entry + 8, littleEndian);
            return value >= 1 && value <= 8 ? value : 1;
          }
        }
        return 1;
      }

      offset += segmentSize;
    }
  } catch {
    /* Unreadable header — treat the photo as upright. */
  }
  return 1;
};

interface DecodedSource {
  source: CanvasImageSource;
  /** Stored (pre-orientation) pixel dimensions. */
  width: number;
  height: number;
  /** EXIF orientation still to be applied by us (1 when the decoder already applied it). */
  orientation: number;
  release: () => void;
}

/**
 * Decodes `file` into something `drawImage` accepts.
 *
 * Preferred path is `createImageBitmap(file, { imageOrientation: 'none' })` — asking for the
 * *stored* pixels explicitly, so we apply the EXIF rotation ourselves and the result is
 * deterministic regardless of the browser's default for that option. The `<img>` fallback
 * (used only where `createImageBitmap` is missing or refuses the blob) leaves orientation to
 * the browser, which honours EXIF for `<img>` sources by default.
 */
const decodeImage = async (file: File): Promise<DecodedSource> => {
  if (typeof createImageBitmap === 'function') {
    try {
      const orientation = await readExifOrientation(file);
      const bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        orientation,
        release: () => bitmap.close?.()
      };
    } catch {
      /* Fall through to the <img> decoder. */
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image could not be decoded'));
      el.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      // <img> sources are already EXIF-oriented by the browser; rotating again would be wrong.
      orientation: 1,
      release: () => URL.revokeObjectURL(objectUrl)
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
};

/** Promisified `canvas.toBlob`, falling back to a `toDataURL` round-trip on older engines. */
const encodeCanvas = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => resolve(blob), type, quality);
      return;
    }
    try {
      const dataUrl = canvas.toDataURL(type, quality);
      const [header, base64] = dataUrl.split(',');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      resolve(new Blob([bytes], { type: /data:([^;]+)/.exec(header)?.[1] || type }));
    } catch {
      resolve(null);
    }
  });

const extensionFor = (mimeType: string) =>
  mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';

const renameForType = (originalName: string, mimeType: string) => {
  const base = (originalName || 'image').replace(/\.[^./\\]+$/, '').trim() || 'image';
  return `${base}.${extensionFor(mimeType)}`;
};

const passthrough = (file: File): ResizedImageResult => ({
  file,
  didProcess: false,
  originalSizeBytes: file.size,
  sizeBytes: file.size
});

/**
 * Downscales and re-encodes `file` for upload.
 *
 * Aspect ratio is preserved, images already within `maxEdge` are never upscaled (they are
 * still re-encoded, which is usually a large win on a phone JPEG), and the original is
 * returned untouched whenever processing is skipped or would produce a *larger* file.
 */
export const resizeImageFile = async (
  file: File,
  options: ResizeImageOptions = {}
): Promise<ResizedImageResult> => {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;

  try {
    if (!file || !file.size) return passthrough(file);
    if (file.type && PASSTHROUGH_TYPES.includes(file.type)) return passthrough(file);

    const decoded = await decodeImage(file);
    try {
      const { source, orientation } = decoded;
      if (!decoded.width || !decoded.height) return passthrough(file);

      // Orientations 5-8 rotate by 90°, so the *displayed* image has its axes swapped.
      const swapsAxes = orientation >= 5 && orientation <= 8;
      const displayWidth = swapsAxes ? decoded.height : decoded.width;
      const displayHeight = swapsAxes ? decoded.width : decoded.height;

      const scale = Math.min(1, maxEdge / Math.max(displayWidth, displayHeight));
      const targetWidth = Math.max(1, Math.round(displayWidth * scale));
      const targetHeight = Math.max(1, Math.round(displayHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return passthrough(file);

      // WebP keeps alpha; JPEG does not, so flatten onto white instead of black.
      const requestedType = options.outputType ?? 'auto';
      const outputType =
        requestedType !== 'auto'
          ? requestedType
          : canEncodeWebP()
            ? 'image/webp'
            : file.type === 'image/png'
              ? 'image/png'
              : 'image/jpeg';

      if (outputType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      switch (orientation) {
        case 2: ctx.transform(-1, 0, 0, 1, targetWidth, 0); break;
        case 3: ctx.transform(-1, 0, 0, -1, targetWidth, targetHeight); break;
        case 4: ctx.transform(1, 0, 0, -1, 0, targetHeight); break;
        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
        case 6: ctx.transform(0, 1, -1, 0, targetWidth, 0); break;
        case 7: ctx.transform(0, -1, -1, 0, targetWidth, targetHeight); break;
        case 8: ctx.transform(0, -1, 1, 0, 0, targetHeight); break;
        default: break;
      }

      // After a 90° transform the canvas axes are swapped relative to the source.
      ctx.drawImage(
        source,
        0,
        0,
        swapsAxes ? targetHeight : targetWidth,
        swapsAxes ? targetWidth : targetHeight
      );

      const blob = await encodeCanvas(canvas, outputType, quality);
      if (!blob || !blob.size) return passthrough(file);

      // A tiny logo re-encoded can come out bigger than it went in — keep the smaller bytes.
      // Callers that pinned an output type need that exact format, so they never take this path.
      if (requestedType === 'auto' && blob.size >= file.size && scale === 1) return passthrough(file);

      const resolvedType = blob.type || outputType;
      return {
        file: new File([blob], renameForType(file.name, resolvedType), {
          type: resolvedType,
          lastModified: Date.now()
        }),
        didProcess: true,
        originalSizeBytes: file.size,
        sizeBytes: blob.size,
        width: targetWidth,
        height: targetHeight
      };
    } finally {
      decoded.release();
    }
  } catch {
    // Never block an upload because the optimiser failed.
    return passthrough(file);
  }
};

/** `1.4 MB` / `312 KB` — used in the upload field's "compressed from…" hint. */
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
