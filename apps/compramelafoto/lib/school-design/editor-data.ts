import type { DesignRevisionDataJsonV1, SlotTransform } from "./types";
import { SCHOOL_DESIGN_REVISION_SCHEMA_VERSION } from "./types";

function asV1(raw: unknown): DesignRevisionDataJsonV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== SCHOOL_DESIGN_REVISION_SCHEMA_VERSION) return null;
  if (!o.assignments || typeof o.assignments !== "object") return null;
  return o as unknown as DesignRevisionDataJsonV1;
}

export function parseRevisionDataJson(raw: unknown): DesignRevisionDataJsonV1 | null {
  return asV1(raw);
}

export function swapSlotPhotosInData(
  data: DesignRevisionDataJsonV1,
  slotIdA: number,
  slotIdB: number
): DesignRevisionDataJsonV1 {
  const ka = String(slotIdA);
  const kb = String(slotIdB);
  const a = data.assignments[ka];
  const b = data.assignments[kb];
  if (!a || !b) return data;
  const next = { ...data, assignments: { ...data.assignments } };
  next.assignments[ka] = { ...a, photoId: b.photoId };
  next.assignments[kb] = { ...b, photoId: a.photoId };
  return next;
}

export function replaceSlotPhotoInData(
  data: DesignRevisionDataJsonV1,
  slotId: number,
  newPhotoId: number
): DesignRevisionDataJsonV1 {
  const k = String(slotId);
  const cur = data.assignments[k];
  if (!cur) return data;
  return {
    ...data,
    assignments: {
      ...data.assignments,
      [k]: { ...cur, photoId: newPhotoId },
    },
  };
}

export function updateTextOverrideInData(data: DesignRevisionDataJsonV1, textId: string, value: string) {
  return {
    ...data,
    textOverrides: { ...data.textOverrides, [textId]: value },
  };
}

export function clearTextOverrideInData(data: DesignRevisionDataJsonV1, textId: string) {
  const next = { ...data.textOverrides };
  delete next[textId];
  return { ...data, textOverrides: next };
}

export function updateSlotTransformInData(
  data: DesignRevisionDataJsonV1,
  slotId: number,
  patch: Partial<SlotTransform>
): DesignRevisionDataJsonV1 {
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

export function resetSlotTransformInData(data: DesignRevisionDataJsonV1, slotId: number): DesignRevisionDataJsonV1 {
  const k = String(slotId);
  const next = { ...data.slotTransforms };
  delete next[k];
  return { ...data, slotTransforms: next };
}
