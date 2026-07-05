/** Nodo unificado para el explorador (álbum simple o evento colaborativo). */
export type ExplorerFolderRow = {
  id: number;
  parentId: number | null;
  name: string;
  path: string;
  sortOrder: number;
  photoCount: number;
  childCount: number;
};

export type AlbumFolderApiRow = {
  id: number;
  parentId: number | null;
  name: string;
  path: string;
  sortOrder: number;
  _count?: { photos?: number; children?: number };
};

export type EventFolderApiRow = {
  id: number;
  name: string;
  parentId?: number | null;
  sortOrder?: number;
  folderScope?: string;
  /** Conteo server-side (GET álbum); evita iterar todas las fotos en cliente. */
  photoCount?: number;
};

export function mapAlbumFoldersToExplorer(rows: AlbumFolderApiRow[]): ExplorerFolderRow[] {
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parentId ?? null,
    name: r.name,
    path: r.path,
    sortOrder: r.sortOrder,
    photoCount: r._count?.photos ?? 0,
    childCount: r._count?.children ?? 0,
  }));
}

/** Cuenta fotos por carpeta de evento desde conteos server-side (`eventFolders[].photoCount`). */
export function mapEventFoldersToExplorer(rows: EventFolderApiRow[]): ExplorerFolderRow[] {
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (typeof r.photoCount === "number") {
      counts.set(r.id, r.photoCount);
    }
  }
  const childCounts = new Map<number, number>();
  for (const r of rows) {
    if (r.parentId != null) {
      childCounts.set(r.parentId, (childCounts.get(r.parentId) ?? 0) + 1);
    }
  }
  return rows
    .map((r) => ({
      id: r.id,
      parentId: r.parentId ?? null,
      name: r.name,
      path: r.name,
      sortOrder: r.sortOrder ?? 0,
      photoCount: counts.get(r.id) ?? 0,
      childCount: childCounts.get(r.id) ?? 0,
    }))
    .sort((a, b) =>
      a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id - b.id
    );
}

export type FolderViewKey = "all" | "none" | number;

export const UNORGANIZED_FOLDER_LABEL = "Fotos sin organizar";

export function folderViewDisplayName(
  folderView: FolderViewKey,
  folders: ExplorerFolderRow[]
): string {
  if (folderView === "all") return "Todas las fotos";
  if (folderView === "none") return UNORGANIZED_FOLDER_LABEL;
  const match = folders.find((f) => f.id === folderView);
  return match?.name ?? "Carpeta";
}

export function buildFolderBreadcrumb(
  folders: ExplorerFolderRow[],
  selection: FolderViewKey
): Array<{ key: FolderViewKey; label: string }> {
  const crumbs: Array<{ key: FolderViewKey; label: string }> = [
    { key: "all", label: "Álbum" },
  ];
  if (selection === "all" || selection === "none") {
    if (selection === "none") {
      crumbs.push({ key: "none", label: UNORGANIZED_FOLDER_LABEL });
    }
    return crumbs;
  }
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: ExplorerFolderRow[] = [];
  let cur = byId.get(selection);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId != null ? byId.get(cur.parentId) : undefined;
  }
  for (const f of chain) {
    crumbs.push({ key: f.id, label: f.name });
  }
  return crumbs;
}

/** Query string para GET /api/dashboard/albums/[id]/photos según vista de carpeta. */
export function folderViewToPhotosQuery(
  folderView: FolderViewKey,
  mode: "album" | "event"
): string {
  if (folderView === "all") return "";
  if (folderView === "none") {
    return mode === "event" ? "eventFolderId=none" : "folderId=none";
  }
  return mode === "event"
    ? `eventFolderId=${encodeURIComponent(String(folderView))}`
    : `folderId=${encodeURIComponent(String(folderView))}`;
}

export function flatFolderSelectOptions(
  folders: ExplorerFolderRow[]
): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [
    { value: "", label: "Elegir carpeta…" },
    { value: "__none__", label: UNORGANIZED_FOLDER_LABEL },
  ];
  function walk(parentId: number | null, depth: number) {
    folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id - b.id))
      .forEach((f) => {
        out.push({
          value: String(f.id),
          label: `${"— ".repeat(depth)}${f.name}`,
        });
        walk(f.id, depth + 1);
      });
  }
  walk(null, 0);
  return out;
}

/** Opciones para selector de destino de subida (sin placeholders de bulk). */
export function flatFolderUploadOptions(
  folders: ExplorerFolderRow[]
): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [
    { value: "", label: "Sin carpeta específica" },
  ];
  function walk(parentId: number | null, depth: number) {
    folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id - b.id))
      .forEach((f) => {
        out.push({
          value: String(f.id),
          label: `${"— ".repeat(depth)}${f.name}`,
        });
        walk(f.id, depth + 1);
      });
  }
  walk(null, 0);
  return out;
}

export type FolderSubtreeStats = {
  folderCount: number;
  photoCount: number;
  subfolderCount: number;
};

/** Totales del árbol (fotos directas por carpeta + subcarpetas bajo la raíz). */
export function folderSubtreeStats(
  folders: ExplorerFolderRow[],
  rootId: number
): FolderSubtreeStats {
  const ids = folderDescendantIds(folders, rootId);
  let photoCount = 0;
  let subfolderCount = 0;
  for (const folder of folders) {
    if (!ids.has(folder.id)) continue;
    if (folder.id !== rootId) subfolderCount++;
    photoCount += folder.photoCount;
  }
  return { folderCount: ids.size, photoCount, subfolderCount };
}

/** IDs del nodo raíz y todos sus descendientes (para bloquear ciclos al mover). */
export function folderDescendantIds(
  folders: ExplorerFolderRow[],
  rootId: number
): Set<number> {
  const out = new Set<number>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of folders) {
      if (f.parentId != null && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        changed = true;
      }
    }
  }
  return out;
}
