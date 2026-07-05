/** Modos del endpoint `/api/photos/[id]/view`. `cover` = portada de álbum en listados (sin watermark). */
export type PublicPhotoViewMode = "preview" | "thumb" | "cover";

/** URL del endpoint que aplica watermark dinámico (no expone original). */
export function buildPhotoViewApiUrl(
  photoId: number,
  albumId: number,
  mode: PublicPhotoViewMode = "preview"
): string {
  return `/api/photos/${photoId}/view?albumId=${albumId}&mode=${mode}`;
}

/**
 * Src público para `<img>`.
 * - `cover`: portada en listados de álbumes — sin marca (solo si es la foto portada del álbum).
 * - `thumb` / `preview`: siempre vía API con marca de agua (miniatura y vista ampliada).
 */
export function resolvePublicPhotoPreviewSrc(params: {
  photoId: number;
  albumId: number;
  storedPreviewUrl?: string | null;
  mode?: PublicPhotoViewMode;
}): string {
  const mode = params.mode ?? "preview";
  return buildPhotoViewApiUrl(params.photoId, params.albumId, mode);
}
