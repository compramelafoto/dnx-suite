/**
 * Estructuras persistidas en DesignRevision.dataJson (equivalente funcional legacy).
 */

export const SCHOOL_DESIGN_REVISION_SCHEMA_VERSION = 1;
export const SCHOOL_PREFLIGHT_SCHEMA_VERSION = 1 as const;

export type Bbox = { x: number; y: number; width: number; height: number };

export type FitMode = "COVER";

export type SlotTransform = {
  fitMode: FitMode;
  /** Normalizado 0–1 relativo al bbox del slot (legacy: x/y = bbox origin; aquí offsets de composición) */
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type AssignmentEntry = {
  slotId: number;
  pageIndex: number;
  photoId: number;
};

export type DesignRevisionDataJsonV1 = {
  schemaVersion: typeof SCHOOL_DESIGN_REVISION_SCHEMA_VERSION;
  assignments: Record<string, AssignmentEntry>;
  unassignedSelectionPhotoIds: number[];
  unfilledRequiredSlotIds: number[];
  preflight: RenderPreflightJsonV1;
  textOverrides: Record<string, string>;
  slotTransforms: Record<string, SlotTransform>;
};

export type RenderPreflightJsonV1 = {
  schemaVersion: typeof SCHOOL_PREFLIGHT_SCHEMA_VERSION;
  slots: Record<
    string,
    {
      slotId: number;
      bbox: Bbox;
      photoId: number | null;
      photoBbox: Bbox | null;
      assetOk: boolean;
      transform: SlotTransform;
    }
  >;
};

export type TemplateResolution =
  | { outcome: "ALBUM_PRODUCT_DEFAULT"; templateId: number }
  | { outcome: "NONE_NO_DESIGN" }
  | { outcome: "PACK_REQUIRED" }
  | { outcome: "AMBIGUOUS"; candidateTemplateIds: number[] }
  | { outcome: "NONE_REQUIRED_MISSING"; reason: string };
