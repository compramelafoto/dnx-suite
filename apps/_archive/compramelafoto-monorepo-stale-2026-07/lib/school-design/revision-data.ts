import type { Prisma } from "@prisma/client";
import type { AssignmentEntry, RenderPreflightJsonV1, SlotTransform } from "./types";
import { SCHOOL_DESIGN_REVISION_SCHEMA_VERSION } from "./types";
import type { TemplateSlotInput } from "./validate-selection";

/** Paridad legacy SCHOOL-PIPELINE-SYNC-LOG (schemaVersion 3). */
export const SCHOOL_DESIGN_REVISION_SCHEMA_VERSION_LEGACY = 3 as const;

export type AssignmentRowV3 = {
  slotId: number;
  pageIndex: number;
  slotRole: string | null;
  selectionPhotoId: number;
  selectionPhotoRole: string | null;
  source: "ROLE_MATCH" | "ORDER_FALLBACK";
};

export type TextOverrideV3 = { overrideValue: string; isOverridden: boolean };

export type ParsedRevision = {
  schemaVersion: 1 | 3;
  templateId?: number;
  orderItemId?: number;
  assignmentsRecord: Record<string, AssignmentEntry>;
  unassignedSelectionPhotoIds: number[];
  unfilledRequiredSlotIds: number[];
  preflight: RenderPreflightJsonV1;
  /** Texto plano para UI simple */
  textOverridesFlat: Record<string, string>;
  textOverridesRaw: Record<string, string | TextOverrideV3>;
  slotTransforms: Record<string, SlotTransform>;
};

function isTextOverrideV3(v: unknown): v is TextOverrideV3 {
  return (
    typeof v === "object" &&
    v !== null &&
    "overrideValue" in v &&
    typeof (v as TextOverrideV3).overrideValue === "string"
  );
}

/**
 * Parsea dataJson v1 o v3 y normaliza a `assignmentsRecord` + metadatos.
 */
export function parseRevisionDataJson(raw: unknown): ParsedRevision | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sv = o.schemaVersion;
  let schemaVersion: 1 | 3 | null =
    sv === SCHOOL_DESIGN_REVISION_SCHEMA_VERSION_LEGACY || sv === 3
      ? 3
      : sv === SCHOOL_DESIGN_REVISION_SCHEMA_VERSION || sv === 1
        ? 1
        : null;
  if (schemaVersion === null && Array.isArray(o.assignments)) schemaVersion = 3;
  if (
    schemaVersion === null &&
    o.assignments &&
    typeof o.assignments === "object" &&
    !Array.isArray(o.assignments)
  ) {
    schemaVersion = 1;
  }
  if (schemaVersion === null) return null;

  let assignmentsRecord: Record<string, AssignmentEntry> = {};

  if (Array.isArray(o.assignments)) {
    for (const row of o.assignments) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const slotId = Number(r.slotId);
      const photoId = Number(r.selectionPhotoId ?? r.photoId);
      const pageIndex = Number(r.pageIndex ?? 0);
      if (!Number.isInteger(slotId) || !Number.isInteger(photoId)) continue;
      assignmentsRecord[String(slotId)] = { slotId, pageIndex, photoId };
    }
  } else if (o.assignments && typeof o.assignments === "object" && !Array.isArray(o.assignments)) {
    assignmentsRecord = o.assignments as Record<string, AssignmentEntry>;
  } else {
    return null;
  }

  const preflight = o.preflight as RenderPreflightJsonV1 | undefined;
  if (!preflight || typeof preflight !== "object") return null;

  const textOverridesRaw = (o.textOverrides && typeof o.textOverrides === "object"
    ? (o.textOverrides as Record<string, string | TextOverrideV3>)
    : {}) as Record<string, string | TextOverrideV3>;
  const textOverridesFlat: Record<string, string> = {};
  for (const [k, v] of Object.entries(textOverridesRaw)) {
    if (typeof v === "string") textOverridesFlat[k] = v;
    else if (isTextOverrideV3(v)) textOverridesFlat[k] = v.overrideValue;
  }

  let slotTransforms = (o.slotTransforms && typeof o.slotTransforms === "object"
    ? (o.slotTransforms as Record<string, SlotTransform>)
    : {}) as Record<string, SlotTransform>;
  const slotOverrides = o.slotOverrides as Record<string, Record<string, unknown>> | undefined;
  if (slotOverrides && typeof slotOverrides === "object") {
    for (const [k, ov] of Object.entries(slotOverrides)) {
      if (!ov || typeof ov !== "object") continue;
      const prev = slotTransforms[k] ?? {
        fitMode: "COVER" as const,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
      };
      slotTransforms = {
        ...slotTransforms,
        [k]: {
          ...prev,
          fitMode: (String(ov.fitMode) as SlotTransform["fitMode"]) || prev.fitMode,
          x: Number(ov.cropX ?? ov.x ?? prev.x),
          y: Number(ov.cropY ?? ov.y ?? prev.y),
          scale: Number(ov.zoom ?? ov.scale ?? prev.scale),
          rotation: Number(ov.rotation ?? prev.rotation),
        },
      };
    }
  }

  return {
    schemaVersion,
    templateId: typeof o.templateId === "number" ? o.templateId : undefined,
    orderItemId: typeof o.orderItemId === "number" ? o.orderItemId : undefined,
    assignmentsRecord,
    unassignedSelectionPhotoIds: Array.isArray(o.unassignedSelectionPhotoIds)
      ? (o.unassignedSelectionPhotoIds as number[])
      : [],
    unfilledRequiredSlotIds: Array.isArray(o.unfilledRequiredSlotIds) ? (o.unfilledRequiredSlotIds as number[]) : [],
    preflight,
    textOverridesFlat,
    textOverridesRaw,
    slotTransforms,
  };
}

export function mergeRevisionDataJsonPatch(
  raw: unknown,
  patch: Record<string, unknown>
): Prisma.InputJsonValue {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

function assignmentRowsFromRecord(
  record: Record<string, AssignmentEntry>,
  slots: TemplateSlotInput[],
  selectionPhotoRoleByPhotoId: Map<number, string | null>
): AssignmentRowV3[] {
  const slotById = new Map(slots.map((s) => [s.id, s]));
  return Object.values(record).map((e) => {
    const slot = slotById.get(e.slotId);
    const pr = selectionPhotoRoleByPhotoId.get(e.photoId) ?? null;
    const sr = slot?.role ?? null;
    const source: AssignmentRowV3["source"] =
      sr && pr && sr === pr ? "ROLE_MATCH" : "ORDER_FALLBACK";
    return {
      slotId: e.slotId,
      pageIndex: e.pageIndex,
      slotRole: sr,
      selectionPhotoId: e.photoId,
      selectionPhotoRole: pr,
      source,
    };
  });
}

function slotTransformsToSlotOverrides(st: Record<string, SlotTransform>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(st)) {
    out[k] = {
      cropX: v.x,
      cropY: v.y,
      zoom: v.scale,
      rotation: v.rotation,
      fitMode: v.fitMode,
      manualOverride: true,
    };
  }
  return out;
}

function textOverridesToV3Object(flat: Record<string, string>, raw: Record<string, string | TextOverrideV3>) {
  const o: Record<string, TextOverrideV3> = {};
  const keys = new Set([...Object.keys(flat), ...Object.keys(raw)]);
  for (const k of keys) {
    const r = raw[k];
    if (isTextOverrideV3(r)) {
      o[k] = r;
    } else if (flat[k] !== undefined) {
      o[k] = { overrideValue: flat[k], isOverridden: true };
    }
  }
  return o;
}

export function serializeRevisionDataJson(
  data: ParsedRevision,
  slots: TemplateSlotInput[],
  selectionPhotoRoleByPhotoId: Map<number, string | null>,
  templateId: number,
  orderItemId: number
): Prisma.InputJsonValue {
  const rows = assignmentRowsFromRecord(data.assignmentsRecord, slots, selectionPhotoRoleByPhotoId);
  const textOverrides = textOverridesToV3Object(data.textOverridesFlat, data.textOverridesRaw as Record<string, string | TextOverrideV3>);

  const base: Record<string, unknown> = {
    schemaVersion: SCHOOL_DESIGN_REVISION_SCHEMA_VERSION_LEGACY,
    templateId,
    orderItemId,
    assignments: rows,
    unassignedSelectionPhotoIds: data.unassignedSelectionPhotoIds,
    unfilledRequiredSlotIds: data.unfilledRequiredSlotIds,
    preflight: data.preflight,
    slotOverrides: slotTransformsToSlotOverrides(data.slotTransforms),
    textOverrides,
    slotTransforms: data.slotTransforms,
  };

  return base as Prisma.InputJsonValue;
}

/** Serializa edición conservando versión si era v1 (migración gradual). */
export function serializeRevisionDataJsonForPersist(
  data: ParsedRevision,
  slots: TemplateSlotInput[],
  selectionPhotoRoleByPhotoId: Map<number, string | null>,
  templateId: number,
  orderItemId: number
): Prisma.InputJsonValue {
  if (data.schemaVersion === 1) {
    const legacy: Record<string, unknown> = {
      schemaVersion: SCHOOL_DESIGN_REVISION_SCHEMA_VERSION,
      assignments: data.assignmentsRecord,
      unassignedSelectionPhotoIds: data.unassignedSelectionPhotoIds,
      unfilledRequiredSlotIds: data.unfilledRequiredSlotIds,
      preflight: data.preflight,
      textOverrides: data.textOverridesFlat,
      slotTransforms: data.slotTransforms,
    };
    return legacy as Prisma.InputJsonValue;
  }
  return serializeRevisionDataJson(data, slots, selectionPhotoRoleByPhotoId, templateId, orderItemId);
}

/** Persistir edición sin borrar claves de preview/export ya guardadas en `dataJson`. */
export function buildPersistDataJsonFromParsed(
  rawPrevious: unknown,
  data: ParsedRevision,
  slots: TemplateSlotInput[],
  selectionPhotoRoleByPhotoId: Map<number, string | null>,
  templateId: number,
  orderItemId: number
): Prisma.InputJsonValue {
  const serialized = serializeRevisionDataJsonForPersist(
    data,
    slots,
    selectionPhotoRoleByPhotoId,
    templateId,
    orderItemId
  );
  return mergeRevisionDataJsonPatch(rawPrevious, serialized as unknown as Record<string, unknown>);
}
