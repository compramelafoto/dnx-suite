import type { ParsedRevision } from "./revision-data";
import { parseRevisionDataJson as parseRevisionDataJsonInner } from "./revision-data";
import type { SlotTransform } from "./types";

export { parseRevisionDataJsonInner as parseRevisionDataJson };

export function swapSlotPhotosInData(
  data: ParsedRevision,
  slotIdA: number,
  slotIdB: number
): ParsedRevision {
  const ka = String(slotIdA);
  const kb = String(slotIdB);
  const a = data.assignmentsRecord[ka];
  const b = data.assignmentsRecord[kb];
  if (!a || !b) return data;
  return {
    ...data,
    assignmentsRecord: {
      ...data.assignmentsRecord,
      [ka]: { ...a, photoId: b.photoId },
      [kb]: { ...b, photoId: a.photoId },
    },
  };
}

export function replaceSlotPhotoInData(
  data: ParsedRevision,
  slotId: number,
  newPhotoId: number
): ParsedRevision {
  const k = String(slotId);
  const cur = data.assignmentsRecord[k];
  if (!cur) return data;
  return {
    ...data,
    assignmentsRecord: {
      ...data.assignmentsRecord,
      [k]: { ...cur, photoId: newPhotoId },
    },
  };
}

export function updateTextOverrideInData(data: ParsedRevision, textId: string, value: string): ParsedRevision {
  const nextRaw = { ...data.textOverridesRaw, [textId]: { overrideValue: value, isOverridden: true } };
  return {
    ...data,
    textOverridesFlat: { ...data.textOverridesFlat, [textId]: value },
    textOverridesRaw: nextRaw,
  };
}

export function clearTextOverrideInData(data: ParsedRevision, textId: string): ParsedRevision {
  const nextFlat = { ...data.textOverridesFlat };
  delete nextFlat[textId];
  const nextRaw = { ...data.textOverridesRaw };
  delete nextRaw[textId];
  return { ...data, textOverridesFlat: nextFlat, textOverridesRaw: nextRaw };
}

export function updateSlotTransformInData(
  data: ParsedRevision,
  slotId: number,
  patch: Partial<SlotTransform>
): ParsedRevision {
  const k = String(slotId);
  const prev = data.slotTransforms[k] ?? {
    fitMode: "COVER" as const,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
  };
  return {
    ...data,
    slotTransforms: {
      ...data.slotTransforms,
      [k]: { ...prev, ...patch },
    },
  };
}

export function resetSlotTransformInData(data: ParsedRevision, slotId: number): ParsedRevision {
  const k = String(slotId);
  const next = { ...data.slotTransforms };
  delete next[k];
  return { ...data, slotTransforms: next };
}
