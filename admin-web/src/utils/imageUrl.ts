/** Converts Google Drive share links into direct-image URLs usable in <img> tags.
 *  Any other URL passes through unchanged. Mirrors the backend ImageUrlNormalizer,
 *  so previews in the admin look exactly like what will be stored and served.
 *  Handled forms:
 *    https://drive.google.com/file/d/{id}/view?usp=sharing
 *    https://drive.google.com/open?id={id}
 *    https://drive.google.com/uc?export=view&id={id}
 */
export const normalizeImageUrl = (url?: string | null): string | undefined => {
  if (!url || !url.trim()) return undefined;
  const trimmed = url.trim();
  if (!/drive\.google\.com/i.test(trimmed)) return trimmed;
  if (/drive\.google\.com\/thumbnail/i.test(trimmed)) return trimmed;
  const match =
    trimmed.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/i) ||
    trimmed.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
  if (!match) return trimmed;
  return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
};
