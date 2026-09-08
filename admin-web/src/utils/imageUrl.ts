const API_BASE_URL = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5050/api/v1';
const API_ORIGIN = API_BASE_URL.replace(/\/api.*$/i, '');

/** Converts Google Drive share links into direct-image URLs usable in <img> tags,
 *  and resolves server-hosted /storage/... paths to absolute API origin.
 *  Any other URL passes through unchanged.
 */
export const normalizeImageUrl = (url?: string | null): string | undefined => {
  if (!url || !url.trim()) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/storage/')) {
    return `${API_ORIGIN}${trimmed}`;
  }
  if (trimmed.startsWith('storage/')) {
    return `${API_ORIGIN}/${trimmed}`;
  }
  if (!/drive\.google\.com/i.test(trimmed)) return trimmed;
  if (/drive\.google\.com\/thumbnail/i.test(trimmed)) return trimmed;
  const match =
    trimmed.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/i) ||
    trimmed.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
  if (!match) return trimmed;
  return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
};
