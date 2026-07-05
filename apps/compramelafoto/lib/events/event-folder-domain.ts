import { EventFolderScope } from "@/lib/prisma";

/** Profundidad máxima desde la raíz de una rama (1=raíz, 2=hijo directo, 3=hijo nieto del evento). */
export const MAX_EVENT_FOLDER_DEPTH_LEVELS = 3;

export type FolderNode = {
  id: number;
  eventId: number;
  parentId: number | null;
  folderScope: EventFolderScope;
  ownerPhotographerId: number | null;
  name: string;
  slug: string | null;
  sortOrder: number;
  isActive: boolean;
  listedInPublicGallery: boolean;
};

export type FolderNodeWithPhotos = FolderNode & { _count?: { photos?: number } };

export function foldersByEventId(rows: FolderNode[]): Map<number, FolderNode> {
  return new Map(rows.map((r) => [r.id, r]));
}

/** childrenByParent map: parentId null → ids raíz de ese tipo en el mismo eventId (filtrado por llamador). */
export function childrenByParentMap(rows: FolderNode[]): Map<number | null, FolderNode[]> {
  const map = new Map<number | null, FolderNode[]>();
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

/** Profundidad 1 desde la raíz (nodo sin parent dentro del set). Ciclo → Infinity simulando error arriba. */
export function depthFromRoot(folderId: number, byId: Map<number, FolderNode>): number {
  let depth = 1;
  let cur: FolderNode | undefined = byId.get(folderId);
  const seen = new Set<number>();
  while (cur?.parentId != null) {
    if (seen.has(cur.id)) return 999;
    seen.add(cur.id);
    cur = byId.get(cur.parentId);
    depth++;
    if (depth > 50) return 999;
  }
  return depth;
}

/**
 * Altura del subárbol con raíz folderId (incluye folderId como fila): hoja ⇒ 1.
 */
export function subtreeHeight(
  folderId: number,
  childrenMap: Map<number | null, FolderNode[]>,
  memo = new Map<number, number>()
): number {
  if (memo.has(folderId)) return memo.get(folderId)!;
  const kids = (childrenMap.get(folderId) ?? []).map((x) => x.id);
  if (kids.length === 0) {
    memo.set(folderId, 1);
    return 1;
  }
  const h = 1 + Math.max(...kids.map((k) => subtreeHeight(k, childrenMap, memo)));
  memo.set(folderId, h);
  return h;
}

export function ancestorWalkHas(
  folderIdStart: number,
  needleId: number,
  byId: Map<number, FolderNode>
): boolean {
  let cur: FolderNode | undefined = byId.get(folderIdStart);
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

/**
 * ¿Mover `candidateId` bajo `newParentId` crea ciclo?
 * Ciclo también si `newParentId` está dentro del subárbol de `candidateId`.
 */
export function wouldCreateCycleMovingUnder(
  candidateId: number,
  newParentId: number | null,
  allById: Map<number, FolderNode>
): boolean {
  if (newParentId === null) return false;
  if (newParentId === candidateId) return true;
  return ancestorWalkHas(newParentId, candidateId, allById);
}

/**
 * Nueva profundidad absoluta máxima del subárbol de `candidateId` si queda hijo directo de `newParent`.
 * `depthFromRoot(newParent)==0` si newParent es null ⇒ raíz nueva con profundidad 1 en la punta superior.
 */
export function maxAbsoluteDepthAfterReparent(opts: {
  candidateId: number;
  newParentId: number | null;
  byId: Map<number, FolderNode>;
  childrenMap: Map<number | null, FolderNode[]>;
}): number {
  const { candidateId, newParentId, byId, childrenMap } = opts;
  const parentDepth = newParentId == null ? 0 : depthFromRoot(newParentId, byId);
  const h = subtreeHeight(candidateId, childrenMap);
  return parentDepth + h;
}

export function validateReparent(opts: {
  candidateId: number;
  newParentId: number | null;
  byId: Map<number, FolderNode>;
  childrenMap: Map<number | null, FolderNode[]>;
  /** Alcance esperado — la carpeta a mover debe ser de este alcance para pasar esta capa */
  enforceScope?: EventFolderScope;
  /** Alcance esperado del padre (null válido sólo cuando reglas llamador aplican). */
  allowParentScopes?: readonly EventFolderScope[];
}): { ok: true } | { ok: false; error: string } {
  const { candidateId, newParentId, byId, childrenMap } = opts;
  const candidate = byId.get(candidateId);
  if (!candidate) return { ok: false, error: "La carpeta no existe." };

  if (opts.enforceScope != null && candidate.folderScope !== opts.enforceScope) {
    return { ok: false, error: "Alcance de carpeta incompatible." };
  }

  if (wouldCreateCycleMovingUnder(candidateId, newParentId, byId)) {
    return {
      ok: false,
      error: "No se puede mover dentro de un descendiente ni sobre sí misma.",
    };
  }

  if (opts.allowParentScopes != null && newParentId != null) {
    const p = byId.get(newParentId);
    if (!p) return { ok: false, error: "La carpeta destino padre no existe." };
    if (!opts.allowParentScopes.includes(p.folderScope)) {
      return {
        ok: false,
        error: "La carpeta destino no permite este tipo de anidamiento.",
      };
    }
  }

  const maxDepth = maxAbsoluteDepthAfterReparent({
    candidateId,
    newParentId,
    byId,
    childrenMap,
  });
  if (maxDepth > MAX_EVENT_FOLDER_DEPTH_LEVELS) {
    return {
      ok: false,
      error: `No se puede exceder ${MAX_EVENT_FOLDER_DEPTH_LEVELS} niveles en la carpeta.`,
    };
  }

  return { ok: true };
}

/** Fotógrafos: solo pueden anidar carpetas auxiliares bajo otras propias del mismo usuario. */
export function validateCreatePhotographerFolder(opts: {
  parentId: number | null;
  rows: FolderNode[];
  photographerUserId: number;
}): { ok: true } | { ok: false; error: string } {
  const byId = foldersByEventId(opts.rows);
  if (opts.parentId != null) {
    const parent = byId.get(opts.parentId);
    if (!parent) return { ok: false, error: "La carpeta padre no existe en este evento." };
    if (parent.folderScope !== EventFolderScope.PHOTOGRAPHER) {
      return {
        ok: false,
        error:
          "Las carpetas auxiliares no pueden colgarse de carpetas oficiales del organizador. Creala en raíz o bajo tu propia jerarquía.",
      };
    }
    if (parent.ownerPhotographerId !== opts.photographerUserId) {
      return { ok: false, error: "No podés usar esa carpeta como padre." };
    }
    const d = depthFromRoot(opts.parentId, byId);
    if (d + 1 > MAX_EVENT_FOLDER_DEPTH_LEVELS) {
      return { ok: false, error: `Máximo ${MAX_EVENT_FOLDER_DEPTH_LEVELS} niveles de carpeta.` };
    }
  }
  return { ok: true };
}
