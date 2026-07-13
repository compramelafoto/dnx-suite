/**
 * View model seguro de previews editoriales.
 * Nunca incluye storage keys, URLs originales comerciales ni credenciales.
 */

export type EditorialPhotoPreviewStatus =
  | "LOADING"
  | "READY"
  | "FAILED"
  | "UNAVAILABLE";

export type EditorialPhotoPreview = {
  photoId: string;
  /** Path same-origin al proxy de thumbs, o null si no hay preview. */
  previewUrl: string | null;
  width?: number;
  height?: number;
  aspectRatio?: number;
  photographerName: string;
  albumName?: string;
  status: EditorialPhotoPreviewStatus;
};

/** Construye el path del proxy de thumb (contrato canónico). */
export function buildClfThumbApiPath(photoId: number | string, albumId: number | string): string {
  const pid = Number(photoId);
  const aid = Number(albumId);
  if (!Number.isFinite(pid) || !Number.isFinite(aid) || pid <= 0 || aid <= 0) {
    throw new Error("photoId y albumId deben ser enteros positivos");
  }
  return `/api/redaccion/clf-photos/${pid}/thumb?albumId=${aid}`;
}

/**
 * Valida que un previewUrl sea un path de proxy seguro (no key, no URL R2, no original).
 */
export function isSafeEditorialPreviewUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (trimmed.includes("..")) return false;
  return trimmed.startsWith("/api/redaccion/clf-photos/") && trimmed.includes("/thumb");
}

/** View model desde listado API (sin exponer campos técnicos). */
export function toEditorialPhotoPreview(input: {
  photoId: number | string;
  albumId: number | string;
  photographerName: string;
  albumName?: string;
}): EditorialPhotoPreview {
  let previewUrl: string | null = null;
  try {
    previewUrl = buildClfThumbApiPath(input.photoId, input.albumId);
  } catch {
    previewUrl = null;
  }
  return {
    photoId: String(input.photoId),
    previewUrl,
    photographerName: input.photographerName.trim() || "Fotógrafo",
    albumName: input.albumName,
    status: previewUrl ? "READY" : "UNAVAILABLE",
    aspectRatio: 1,
  };
}

/** ¿Se puede seleccionar? Solo si hay preview path válido. */
export function canSelectEditorialPhoto(preview: EditorialPhotoPreview): boolean {
  return (
    preview.status !== "UNAVAILABLE" &&
    preview.status !== "FAILED" &&
    isSafeEditorialPreviewUrl(preview.previewUrl)
  );
}
