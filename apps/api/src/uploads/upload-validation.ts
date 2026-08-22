/**
 * MIME-type sniffing yalnızca dosya uzantısına değil gerçek içeriğe (magic bytes)
 * dayanır — bkz. Bölüm 6.6/9.4/12: "sadece uzantıya güvenme, MIME-type sahteciliği
 * kritik bir güvenlik riski."
 */
export const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg', // .mp3
  'audio/wav',
  'audio/x-wav',
  'audio/mp4', // .m4a (MPEG-4 audio container)
  'audio/x-m4a',
  'video/mp4',
  'video/quicktime', // .mov
]);

export const DEFAULT_MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB

export function getMaxUploadBytes(): number {
  const raw = process.env.UPLOAD_MAX_BYTES;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_UPLOAD_BYTES;
}

export function isAllowedMimeType(mime: string | undefined): boolean {
  return !!mime && ALLOWED_MIME_TYPES.has(mime);
}
