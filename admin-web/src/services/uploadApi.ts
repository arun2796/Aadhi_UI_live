import { apiClient } from './apiClient';

/**
 * Bucket folder an object is filed under. The API validates this list, so keep it in sync
 * with the server's allowed folders rather than passing free-form strings.
 */
export type UploadFolder =
  | 'products'
  | 'categories'
  | 'brands'
  | 'banners'
  | 'combos'
  | 'settings'
  | 'payment-proofs';

/** 200 body of POST /uploads/image. `url` is the permanent public URL to store on the entity. */
export interface UploadedImage {
  url: string;
  key: string;
  contentType: string;
  sizeBytes: number;
}

export interface UploadImageOptions {
  /** 0-100, fired as the request body streams out. Only reported when the browser exposes a total. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * Image uploads can be an order of magnitude slower than a JSON write on a shop's mobile
 * connection, so they opt out of the client's default 30s timeout.
 */
const UPLOAD_TIMEOUT_MS = 120_000;

export const uploadApi = {
  /**
   * POSTs one image to R2 and returns its permanent public URL.
   *
   * The file is sent as `multipart/form-data` under the field name `file`. Overriding the
   * content-type here is load-bearing, not decorative: `apiClient` defaults every request to
   * `application/json`, and axios' `transformRequest` serialises a FormData body to JSON when
   * it sees that header. Declaring multipart keeps the body intact; axios then drops the header
   * so the browser can attach the real boundary.
   *
   * The response is unwrapped from the app-wide `{ data: … }` envelope when present, so the
   * method works whether or not the endpoint uses it.
   */
  uploadImage: async (
    file: File,
    folder?: UploadFolder,
    options: UploadImageOptions = {}
  ): Promise<UploadedImage> => {
    const formData = new FormData();
    formData.append('file', file, file.name);
    if (folder) formData.append('folder', folder);

    const res = await apiClient.post<{ data?: UploadedImage } & Partial<UploadedImage>>(
      '/uploads/image',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT_MS,
        signal: options.signal,
        onUploadProgress: (event) => {
          if (!options.onProgress) return;
          const total = event.total || file.size;
          if (!total) return;
          options.onProgress(Math.min(100, Math.round((event.loaded / total) * 100)));
        }
      }
    );

    const payload = (res.data?.data ?? res.data) as UploadedImage | undefined;
    if (!payload?.url) {
      throw new Error('Upload succeeded but the server did not return an image URL');
    }
    return payload;
  }
};
