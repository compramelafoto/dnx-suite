import type { Bbox } from "./types";

export type TemplateSlotInput = {
  id: number;
  pageIndex: number;
  index: number;
  role: string | null;
  bbox: unknown;
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

/**
 * Validación mínima de selección vs plantilla (slots requeridos con bbox válido).
 * Equivalente: validateSelectionAgainstTemplate (legacy).
 */
export function validateSelectionAgainstTemplate(input: {
  slots: TemplateSlotInput[];
  selectionPhotoIdsOrdered: number[];
  minFotos: number;
  maxFotos: number;
}): ValidateSelectionResult {
  const slotsOrdered = [...input.slots].sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    if (a.index !== b.index) return a.index - b.index;
    return a.id - b.id;
  });

  const requiredSlots = slotsOrdered.filter((s) => {
    const bbox = parseBbox(s.bbox);
    return bbox !== null;
  });

  const n = input.selectionPhotoIdsOrdered.length;
  const unfilled: number[] = [];
  if (n < input.minFotos || n > input.maxFotos) {
    for (const s of requiredSlots) {
      unfilled.push(s.id);
    }
    return {
      ok: false,
      unfilledRequiredSlotIds: unfilled,
      unassignedSelectionPhotoIds: [...input.selectionPhotoIdsOrdered],
      slotsOrdered,
    };
  }

  if (n < requiredSlots.length) {
    const take = requiredSlots.slice(n);
    for (const s of take) unfilled.push(s.id);
    return {
      ok: false,
      unfilledRequiredSlotIds: unfilled,
      unassignedSelectionPhotoIds: [],
      slotsOrdered,
    };
  }

  const unassigned =
    n > requiredSlots.length ? input.selectionPhotoIdsOrdered.slice(requiredSlots.length) : [];

  return {
    ok: unfilled.length === 0,
    unfilledRequiredSlotIds: unfilled,
    unassignedSelectionPhotoIds: unassigned,
    slotsOrdered,
  };
}
