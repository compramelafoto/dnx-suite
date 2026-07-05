/** Tamaño de página del explorador de fotos en dashboard. */
export const ALBUM_EXPLORER_PHOTOS_PAGE_SIZE = 200;

export type ExplorerPhotoApiRow = {
  id: number;
  previewUrl?: string | null;
  originalKey?: string | null;
  userId?: number | null;
  folderId?: number | null;
  eventFolderId?: number | null;
  sellDigital?: boolean;
  sellPrint?: boolean;
  canDelete?: boolean;
};

export type ExplorerPhotoListResponse = {
  photos?: ExplorerPhotoApiRow[];
  totalCount?: number;
  nextCursor?: string | null;
};

export function buildExplorerPhotosListUrl(
  albumId: number,
  folderQuery: string,
  opts?: { cursor?: string | null; limit?: number }
): string {
  const limit = opts?.limit ?? ALBUM_EXPLORER_PHOTOS_PAGE_SIZE;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (folderQuery) {
    for (const part of folderQuery.split("&")) {
      const [key, value] = part.split("=");
      if (key) params.set(key, value ?? "");
    }
  }
  if (opts?.cursor) {
    params.set("cursor", opts.cursor);
  }
  return `/api/dashboard/albums/${albumId}/photos?${params.toString()}`;
}

export function mapExplorerPhotoFromApi(row: ExplorerPhotoApiRow) {
  return {
    id: row.id,
    previewUrl: row.previewUrl ?? "",
    originalKey: row.originalKey ?? "",
    userId: row.userId,
    folderId: row.folderId,
    eventFolderId: row.eventFolderId,
    sellDigital: row.sellDigital,
    sellPrint: row.sellPrint,
    canDelete: row.canDelete,
  };
}

export function mergeExplorerPhotoPages<T extends { id: number }>(
  existing: T[],
  incoming: T[]
): T[] {
  if (incoming.length === 0) return existing;
  const ids = new Set(existing.map((p) => p.id));
  const unique = incoming.filter((p) => !ids.has(p.id));
  return unique.length === 0 ? existing : [...existing, ...unique];
}

export function formatExplorerPhotoCountLabel(
  loadedCount: number,
  totalCount: number | null,
  loading: boolean
): string {
  if (loading) return "Cargando…";
  const total = totalCount ?? loadedCount;
  if (total <= loadedCount) {
    return loadedCount === 1 ? "1 foto" : `${loadedCount} fotos`;
  }
  return `Mostrando ${loadedCount} de ${total} fotos`;
}
