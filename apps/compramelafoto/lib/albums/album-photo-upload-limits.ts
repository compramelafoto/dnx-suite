/** Límite seguro para subida vía servidor (evita body limit ~4.5 MB en Vercel). */
export const ALBUM_PHOTO_PROXY_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export function getAlbumPhotoMaxBytes(): number {
  return process.env.MAX_FILE_SIZE
    ? parseInt(process.env.MAX_FILE_SIZE, 10)
    : 10 * 1024 * 1024;
}

export function getAlbumPhotoMaxMb(): number {
  return Math.round(getAlbumPhotoMaxBytes() / 1024 / 1024);
}

export const ALBUM_PHOTO_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
