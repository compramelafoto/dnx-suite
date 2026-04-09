import type { Bbox } from "./types";

export type TemplateSlotInput = {
  id: number;
  pageIndex: number;
  index: number;
  role: string | null;
  bbox: unknown;
};

export type SelectionPhotoInput = {
  photoId: number;
  role: string | null;
  position: number | null;
};

export type ValidateSelectionResult = {
  ok: boolean;
  unfilledRequiredSlotIds: number[];
  unassignedSelectionPhotoIds: number[];
  slotsOrdered: TemplateSlotInput[];
};

function parseBbox(raw: unknown): Bbox | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const w = Number(o.width);
  const h = Number(o.height);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  return { x, y, width: w, height: h };
}

function countBy<K extends string, T>(items: T[], key: (t: T) => K | null): Map<K, number> {
  const m = new Map<K, number>();
  for (const it of items) {
    const k = key(it);
    if (k == null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * Validación de selección vs plantilla (legacy: cantidad y/o roles en slots).
 */
export function validateSelectionAgainstTemplate(input: {
  slots: TemplateSlotInput[];
  selectionPhotos: SelectionPhotoInput[];
  minFotos: number;
  maxFotos: number;
}): ValidateSelectionResult {
  const slotsOrdered = [...input.slots].sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    if (a.index !== b.index) return a.index - b.index;
    return a.id - b.id;
  });

  const requiredSlots = slotsOrdered.filter((s) => parseBbox(s.bbox) !== null);
  const n = input.selectionPhotos.length;
  const unfilled: number[] = [];

  if (n < input.minFotos || n > input.maxFotos) {
    for (const s of requiredSlots) unfilled.push(s.id);
    return {
      ok: false,
      unfilledRequiredSlotIds: unfilled,
      unassignedSelectionPhotoIds: input.selectionPhotos.map((p) => p.photoId),
      slotsOrdered,
    };
  }

  const hasSlotRoles = requiredSlots.some((s) => s.role != null && String(s.role).length > 0);

  if (!hasSlotRoles) {
    if (n < requiredSlots.length) {
      for (const s of requiredSlots.slice(n)) unfilled.push(s.id);
      return {
        ok: false,
        unfilledRequiredSlotIds: unfilled,
        unassignedSelectionPhotoIds: [],
        slotsOrdered,
      };
    }
    const ordered = [...input.selectionPhotos].sort((a, b) => {
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      if (pa !== pb) return pa - pb;
      return a.photoId - b.photoId;
    });
    const unassigned =
      n > requiredSlots.length ? ordered.slice(requiredSlots.length).map((p) => p.photoId) : [];
    return {
      ok: unfilled.length === 0,
      unfilledRequiredSlotIds: unfilled,
      unassignedSelectionPhotoIds: unassigned,
      slotsOrdered,
    };
  }

  const roleNeeded = countBy(
    requiredSlots.filter((s) => s.role),
    (s) => String(s.role) as string
  );
  const templateRoleSet = new Set(roleNeeded.keys());

  const photosWithRole = input.selectionPhotos.filter((p) => p.role != null && String(p.role).length > 0);
  const roleHave = countBy(photosWithRole, (p) => String(p.role) as string);

  for (const p of input.selectionPhotos) {
    if (p.role != null && String(p.role).length > 0 && !templateRoleSet.has(String(p.role))) {
      return {
        ok: false,
        unfilledRequiredSlotIds: requiredSlots.map((s) => s.id),
        unassignedSelectionPhotoIds: [],
        slotsOrdered,
      };
    }
  }

  for (const [role, need] of roleNeeded) {
    const have = roleHave.get(role) ?? 0;
    if (have !== need) {
      return {
        ok: false,
        unfilledRequiredSlotIds: requiredSlots.filter((s) => s.role === role).map((s) => s.id),
        unassignedSelectionPhotoIds: [],
        slotsOrdered,
      };
    }
  }

  const slotsNoRole = requiredSlots.filter((s) => !s.role);
  const nullRolePhotos = input.selectionPhotos.filter((p) => p.role == null || String(p.role).length === 0);
  if (nullRolePhotos.length < slotsNoRole.length) {
    return {
      ok: false,
      unfilledRequiredSlotIds: slotsNoRole.map((s) => s.id),
      unassignedSelectionPhotoIds: [],
      slotsOrdered,
    };
  }

  return {
    ok: true,
    unfilledRequiredSlotIds: [],
    unassignedSelectionPhotoIds: [],
    slotsOrdered,
  };
}
