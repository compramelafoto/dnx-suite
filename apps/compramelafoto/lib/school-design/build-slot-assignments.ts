import type { AssignmentEntry, Bbox } from "./types";
import type { AssignmentRowV3 } from "./revision-data";
import type { TemplateSlotInput } from "./validate-selection";

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

type PhotoMeta = { id: number; position: number | null; role: string | null };

/**
 * Orden estable: slots por pageIndex → index → id; fotos por position → id.
 * ROLE_MATCH cuando slot.role y foto.role coinciden; si no, ORDER_FALLBACK.
 */
export function buildInitialTemplateSlotAssignments(input: {
  slots: TemplateSlotInput[];
  selectionPhotos: PhotoMeta[];
}): {
  assignments: Record<string, AssignmentEntry>;
  assignmentRowsV3: AssignmentRowV3[];
  unassignedSelectionPhotoIds: number[];
  unfilledRequiredSlotIds: number[];
} {
  const slotsOrdered = [...input.slots].sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    if (a.index !== b.index) return a.index - b.index;
    return a.id - b.id;
  });

  const photosOrdered = [...input.selectionPhotos].sort((a, b) => {
    const pa = a.position ?? 0;
    const pb = b.position ?? 0;
    if (pa !== pb) return pa - pb;
    return a.id - b.id;
  });

  const requiredSlots = slotsOrdered.filter((s) => parseBbox(s.bbox) !== null);
  const assignments: Record<string, AssignmentEntry> = {};
  const assignmentRowsV3: AssignmentRowV3[] = [];
  const usedPhotoIds = new Set<number>();
  const unfilled: number[] = [];

  for (const slot of requiredSlots) {
    let photo: PhotoMeta | undefined;
    let source: AssignmentRowV3["source"] = "ORDER_FALLBACK";
    if (slot.role) {
      photo = photosOrdered.find((p) => !usedPhotoIds.has(p.id) && p.role === slot.role);
      if (photo) source = "ROLE_MATCH";
    }
    if (!photo) {
      photo = photosOrdered.find((p) => !usedPhotoIds.has(p.id));
      source = "ORDER_FALLBACK";
    }
    if (!photo) {
      unfilled.push(slot.id);
      continue;
    }
    usedPhotoIds.add(photo.id);
    assignments[String(slot.id)] = {
      slotId: slot.id,
      pageIndex: slot.pageIndex,
      photoId: photo.id,
    };
    assignmentRowsV3.push({
      slotId: slot.id,
      pageIndex: slot.pageIndex,
      slotRole: slot.role,
      selectionPhotoId: photo.id,
      selectionPhotoRole: photo.role,
      source,
    });
  }

  const unassignedSelectionPhotoIds = photosOrdered.filter((p) => !usedPhotoIds.has(p.id)).map((p) => p.id);

  return {
    assignments,
    assignmentRowsV3,
    unassignedSelectionPhotoIds,
    unfilledRequiredSlotIds: unfilled,
  };
}
