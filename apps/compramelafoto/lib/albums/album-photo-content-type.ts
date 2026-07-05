import { ALBUM_PHOTO_ALLOWED_TYPES } from "@/lib/albums/album-photo-upload-limits";

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** Infiere MIME de álbum solo por extensión (iOS suele dejar file.type vacío). */
export function inferAlbumPhotoContentTypeFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = filename.slice(dot + 1).toLowerCase();
  return EXT_TO_MIME[ext] ?? "";
}

/**
 * Tipo efectivo para subida: confía en file.type salvo vacío u octet-stream genérico;
 * entonces infiere por extensión.
 */
export function resolveAlbumPhotoContentType(
  filename: string,
  reportedType?: string | null
): string {
  const normalized = (String(reportedType ?? "")
    .toLowerCase()
    .split(";")[0] ?? "")
    .trim();
  if (
    normalized &&
    normalized !== "application/octet-stream" &&
    ALBUM_PHOTO_ALLOWED_TYPES.has(normalized)
  ) {
    return normalized;
  }
  const inferred = inferAlbumPhotoContentTypeFromFilename(filename);
  if (inferred && ALBUM_PHOTO_ALLOWED_TYPES.has(inferred)) {
    return inferred;
  }
  return normalized || inferred || "";
}

export type AlbumPhotoUploadLogPhase = "init" | "storage_put" | "complete" | "proxy";

/** Log mínimo para diagnóstico (sin datos sensibles). */
export function logAlbumPhotoUploadIssue(params: {
  phase: AlbumPhotoUploadLogPhase;
  filename: string;
  sizeBytes: number;
  contentType: string;
  error?: string;
  albumId?: number;
}): void {
  console.info("[album-photo-upload]", {
    phase: params.phase,
    filename: params.filename,
    sizeBytes: params.sizeBytes,
    contentType: params.contentType,
    ...(params.albumId != null ? { albumId: params.albumId } : {}),
    ...(params.error ? { error: params.error.slice(0, 240) } : {}),
  });
}

/** Concurrencia segura: 1 en móvil táctil, 3 en escritorio. */
export function isLikelyMobileUploadDevice(): boolean {
  if (typeof window === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } })
    .userAgentData;
  if (uaData?.mobile === true) return true;
  const coarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const narrowViewport =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 768px)").matches;
  return Boolean(coarsePointer && narrowViewport);
}

export function getAlbumPhotoUploadConcurrency(): number {
  return isLikelyMobileUploadDevice() ? 1 : 3;
}
