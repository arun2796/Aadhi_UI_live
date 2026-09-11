import React, { useRef, useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Link as LinkIcon,
  X,
  RefreshCw,
  Check
} from 'lucide-react';
import { uploadApi, UploadFolder } from '../../services/uploadApi';
import { getApiErrorDetails } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { resizeImageFile, formatBytes, DEFAULT_MAX_EDGE } from '../../utils/imageResize';

export interface ImageUploadFieldProps {
  /** Current image URL. Single-image mode only (ignored when `multiple`). */
  value?: string | null;
  /** Receives the uploaded/pasted URL, or `''` when the image is removed. Single-image mode only. */
  onChange?: (url: string) => void;

  /** Gallery mode: no single preview, every file in one drop is uploaded and reported together. */
  multiple?: boolean;
  /** Receives every URL produced by one drop / selection / paste. Multiple mode only. */
  onUpload?: (urls: string[]) => void;

  /** Bucket folder the object is filed under (`products`, `categories`, …). */
  folder?: UploadFolder;

  label?: string;
  /** Small helper line under the control (recommended dimensions, etc.). */
  hint?: string;
  required?: boolean;
  disabled?: boolean;

  /** Show the "or paste a URL" row. Defaults to true — the shop still has Drive links to migrate. */
  allowUrlInput?: boolean;
  urlPlaceholder?: string;

  /** Height / aspect utility classes for the preview box, e.g. `h-52` or `aspect-[16/6]`. */
  previewClassName?: string;
  /** `contain` for logos and brand marks, `cover` (default) for photography. */
  previewFit?: 'cover' | 'contain';
  /** Drops the preview box entirely — for callers that render their own (e.g. a gallery grid). */
  hidePreview?: boolean;

  /** Longest edge of the re-encoded upload. Defaults to 1600 px. */
  maxEdge?: number;
  className?: string;
}

const isImageFile = (file: File) => !file.type || file.type.startsWith('image/');

/**
 * The single image control used by every admin module that stores an image URL.
 *
 * Upload is the primary path: files arrive by click or drag-and-drop, are downscaled and
 * re-encoded in the browser (see `utils/imageResize`), and are POSTed to `/uploads/image`,
 * which returns the permanent R2 URL that gets written onto the entity. Pasting a URL stays
 * available as a secondary path for the shop's existing Google Drive links; pasted values go
 * through `normalizeImageUrl` exactly as they did before.
 */
export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  value,
  onChange,
  multiple = false,
  onUpload,
  folder,
  label,
  hint,
  required = false,
  disabled = false,
  allowUrlInput = true,
  urlPlaceholder,
  previewClassName = 'h-44',
  previewFit = 'cover',
  hidePreview = false,
  maxEdge = DEFAULT_MAX_EDGE,
  className = ''
}) => {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchLabel, setBatchLabel] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [savings, setSavings] = useState<{ from: number; to: number } | null>(null);

  const busy = isUploading || disabled;
  const previewUrl = !multiple && value ? normalizeImageUrl(value) || value : '';

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFiles = async (incoming: FileList | File[] | null) => {
    const all = Array.from(incoming || []);
    if (!all.length) return;

    const accepted = all.filter(isImageFile);
    if (accepted.length < all.length) {
      const skipped = all.length - accepted.length;
      showToast(`${skipped} file${skipped > 1 ? 's' : ''} skipped — only images can be uploaded`, 'warning');
    }
    if (!accepted.length) {
      resetInput();
      return;
    }

    const queue = multiple ? accepted : accepted.slice(0, 1);
    const uploaded: string[] = [];
    let lastSavings: { from: number; to: number } | null = null;

    setIsUploading(true);
    setSavings(null);
    try {
      for (let i = 0; i < queue.length; i++) {
        setBatchLabel(queue.length > 1 ? `${i + 1} / ${queue.length}` : '');
        setProgress(0);
        // Resizing never throws — it hands back the original file if anything went wrong.
        const resized = await resizeImageFile(queue[i], { maxEdge });
        const result = await uploadApi.uploadImage(resized.file, folder, { onProgress: setProgress });
        uploaded.push(result.url);
        lastSavings = resized.didProcess
          ? { from: resized.originalSizeBytes, to: resized.sizeBytes }
          : null;
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Image upload failed', 'error');
    } finally {
      setIsUploading(false);
      setProgress(0);
      setBatchLabel('');
      resetInput();
    }

    if (!uploaded.length) return;
    setSavings(lastSavings);

    if (multiple) {
      onUpload?.(uploaded);
    } else {
      onChange?.(uploaded[0]);
    }

    const suffix = lastSavings ? ` (${formatBytes(lastSavings.from)} → ${formatBytes(lastSavings.to)})` : '';
    showToast(
      uploaded.length > 1 ? `${uploaded.length} images uploaded` : `Image uploaded${suffix}`,
      'success'
    );
  };

  const applyUrlDraft = () => {
    const raw = urlDraft.trim();
    if (!raw) return;

    const tokens = (multiple ? raw.split(/[\n,]+/) : [raw])
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => normalizeImageUrl(t) ?? t);

    if (!tokens.length) return;
    setSavings(null);
    setUrlDraft('');

    if (multiple) {
      onUpload?.(tokens);
      showToast(`${tokens.length} image link${tokens.length > 1 ? 's' : ''} added`, 'success');
    } else {
      onChange?.(tokens[0]);
      showToast('Image link applied', 'success');
    }
  };

  const openPicker = () => {
    if (busy) return;
    inputRef.current?.click();
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (busy) return;
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (busy) return;
    void handleFiles(e.dataTransfer?.files ?? null);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="text-[11px] font-bold text-navy flex items-center justify-between gap-2">
          <span>
            {label}
            {required && <span className="text-red-500"> *</span>}
          </span>
          <span className="text-[10px] text-purple font-semibold">
            Auto-resized to {maxEdge}px
          </span>
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {/* Preview (single-image mode) */}
      {!multiple && !hidePreview && (
        <div
          className={`relative rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs ${previewClassName}`}
        >
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt="Selected image preview"
                className={`w-full h-full ${previewFit === 'contain' ? 'object-contain p-2' : 'object-cover'}`}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.visibility = 'hidden';
                }}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => {
                    setSavings(null);
                    onChange?.('');
                    showToast('Image removed', 'info');
                  }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-xs transition-colors"
                  title="Remove image"
                  aria-label="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
              <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-2">
                <ImageIcon className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-[11px] font-bold text-navy">No image yet</p>
            </div>
          )}
        </div>
      )}

      {/* Drop zone — the primary path */}
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative w-full rounded-2xl border-2 border-dashed px-4 py-4 text-center transition-colors outline-none ${
          busy
            ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-80'
            : isDragging
              ? 'cursor-pointer border-purple bg-purple-soft'
              : 'cursor-pointer border-slate-200 bg-slate-50 hover:border-purple hover:bg-purple-soft/40 focus-visible:border-purple'
        }`}
      >
        {isUploading ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-navy">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple" />
              <span>
                Uploading{batchLabel ? ` ${batchLabel}` : ''}… {progress}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-purple transition-all duration-200"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-navy">
              <Upload className="w-3.5 h-3.5 text-purple" />
              <span>
                {multiple ? 'Upload images' : value ? 'Replace image' : 'Upload image'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Click or drag {multiple ? 'files' : 'a file'} here — resized and compressed before upload
            </p>
          </div>
        )}
      </div>

      {savings && !isUploading && (
        <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
          <Check className="w-3 h-3" />
          <span>
            Compressed {formatBytes(savings.from)} → {formatBytes(savings.to)} before upload
          </span>
        </p>
      )}

      {/* Secondary path: paste an existing URL (Google Drive links still normalise) */}
      {allowUrlInput && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl focus-within:border-purple transition-colors min-w-0">
              <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {multiple ? (
                <textarea
                  rows={1}
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  disabled={busy}
                  placeholder={urlPlaceholder || '…or paste image links (one per line or comma separated)'}
                  aria-label="Paste image URLs"
                  className="w-full bg-transparent outline-none text-xs text-navy placeholder-slate-400 resize-y"
                />
              ) : (
                <input
                  type="text"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  disabled={busy}
                  placeholder={urlPlaceholder || '…or paste an image URL'}
                  aria-label="Paste an image URL"
                  className="w-full bg-transparent outline-none text-xs text-navy placeholder-slate-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyUrlDraft();
                    }
                  }}
                />
              )}
            </div>
            <button
              type="button"
              onClick={applyUrlDraft}
              disabled={busy || !urlDraft.trim()}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-navy text-xs font-bold shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Use link
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Google Drive share links still work, but uploaded images load far faster.
          </p>
        </div>
      )}

      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
};

export default ImageUploadField;
