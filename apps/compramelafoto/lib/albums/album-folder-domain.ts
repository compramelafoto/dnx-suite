/** Profundidad máxima del árbol de carpetas de álbum (incluye raíz). */
export const MAX_ALBUM_FOLDER_DEPTH_LEVELS = 20;

export type AlbumFolderNode = {
  id: number;
  albumId: number;
  parentId: number | null;
  name: string;
  path: string;
  sortOrder: number;
};

export function albumFoldersById(rows: AlbumFolderNode[]): Map<number, AlbumFolderNode> {
  return new Map(rows.map((r) => [r.id, r]));
}

export function albumChildrenByParentMap(
  rows: AlbumFolderNode[]
): Map<number | null, AlbumFolderNode[]> {
  const map = new Map<number | null, AlbumFolderNode[]>();
  for (const r of rows) {
    const p = r.parentId ?? null;
    const prev = map.get(p) ?? [];
    prev.push(r);
    map.set(p, prev);
  }
  for (const [, list] of map) {
    list.sort((a, b) =>
      a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id - b.id
    );
  }
  return map;
}

export function albumFolderDepthFromRoot(
  folderId: number,
  byId: Map<number, AlbumFolderNode>
): number {
  let depth = 1;
  let cur: AlbumFolderNode | undefined = byId.get(folderId);
  const seen = new Set<number>();
  while (cur?.parentId != null) {
    if (seen.has(cur.id)) return 999;
    seen.add(cur.id);
    cur = byId.get(cur.parentId);
    depth++;
    if (depth > 100) return 999;
  }
  return depth;
}

export function albumFolderSubtreeHeight(
  folderId: number,
  childrenMap: Map<number | null, AlbumFolderNode[]>,
  memo = new Map<number, number>()
): number {
  if (memo.has(folderId)) return memo.get(folderId)!;
  const kids = (childrenMap.get(folderId) ?? []).map((x) => x.id);
  if (kids.length === 0) {
    memo.set(folderId, 1);
    return 1;
  }
  const h = 1 + Math.max(...kids.map((k) => albumFolderSubtreeHeight(k, childrenMap, memo)));
  memo.set(folderId, h);
  return h;
}

function ancestorWalkHas(
  folderIdStart: number,
  needleId: number,
  byId: Map<number, AlbumFolderNode>
): boolean {
  let cur: AlbumFolderNode | undefined = byId.get(folderIdStart);
  const seen = new Set<number>();
  while (cur != null) {
    if (cur.id === needleId) return true;
    if (cur.parentId == null) break;
    if (seen.has(cur.id)) return true;
    seen.add(cur.id);
    cur = byId.get(cur.parentId);
  }
  return false;
}

export function albumFolderWouldCreateCycle(
  candidateId: number,
  newParentId: number | null,
  allById: Map<number, AlbumFolderNode>
): boolean {
  if (newParentId === null) return false;
  if (newParentId === candidateId) return true;
  return ancestorWalkHas(newParentId, candidateId, allById);
}

export function albumFolderMaxDepthAfterReparent(opts: {
  candidateId: number;
  newParentId: number | null;
  byId: Map<number, AlbumFolderNode>;
  childrenMap: Map<number | null, AlbumFolderNode[]>;
}): number {
  const { candidateId, newParentId, byId, childrenMap } = opts;
  const parentDepth = newParentId == null ? 0 : albumFolderDepthFromRoot(newParentId, byId);
  const h = albumFolderSubtreeHeight(candidateId, childrenMap);
  return parentDepth + h;
}

export function validateAlbumFolderReparent(opts: {
  candidateId: number;
  newParentId: number | null;
  byId: Map<number, AlbumFolderNode>;
  childrenMap: Map<number | null, AlbumFolderNode[]>;
}): { ok: true } | { ok: false; error: string } {
  const { candidateId, newParentId, byId, childrenMap } = opts;
  const candidate = byId.get(candidateId);
  if (!candidate) return { ok: false, error: "La carpeta no existe." };

  if (albumFolderWouldCreateCycle(candidateId, newParentId, byId)) {
    return {
      ok: false,
      error: "No se puede mover dentro de un descendiente ni sobre sí misma.",
    };
  }

  if (newParentId != null) {
    const p = byId.get(newParentId);
    if (!p) return { ok: false, error: "La carpeta destino padre no existe." };
    if (p.albumId !== candidate.albumId) {
      return { ok: false, error: "La carpeta padre no pertenece a este álbum." };
    }
  }

  const maxDepth = albumFolderMaxDepthAfterReparent({
    candidateId,
    newParentId,
    byId,
    childrenMap,
  });
  if (maxDepth > MAX_ALBUM_FOLDER_DEPTH_LEVELS) {
    return {
      ok: false,
      error: `No se puede exceder ${MAX_ALBUM_FOLDER_DEPTH_LEVELS} niveles de carpeta.`,
    };
  }

  return { ok: true };
}

export function validateAlbumFolderCreate(opts: {
  parentId: number | null;
  rows: AlbumFolderNode[];
}): { ok: true } | { ok: false; error: string } {
  const byId = albumFoldersById(opts.rows);
  if (opts.parentId != null) {
    const parent = byId.get(opts.parentId);
    if (!parent) return { ok: false, error: "La carpeta padre no existe en este álbum." };
    const d = albumFolderDepthFromRoot(opts.parentId, byId);
    if (d + 1 > MAX_ALBUM_FOLDER_DEPTH_LEVELS) {
      return {
        ok: false,
        error: `Máximo ${MAX_ALBUM_FOLDER_DEPTH_LEVELS} niveles de carpeta.`,
      };
    }
  }
  return { ok: true };
}
