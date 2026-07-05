import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/prisma";

export type EditorDataJson = {
  schemaVersion: number;
  templateId: number | null;
  orderItemId: number | null;
  assignments: Array<{
    slotId: number;
    slotRole: string | null;
    selectionPhotoId: number;
    selectionPhotoRole: string | null;
    source?: string | null;
  }>;
  unassignedSelectionPhotoIds: number[];
  unfilledRequiredSlotIds: number[];
  preflight?: unknown;
  slotOverrides: Record<
    string,
    {
      selectionPhotoId?: number;
      cropX?: number;
      cropY?: number;
      zoom?: number;
      rotation?: number;
      fitMode?: string;
      manualOverride?: boolean;
    }
  >;
  textOverrides: Record<
    string,
    {
      sourceKey?: string | null;
      resolvedValue?: string | null;
      overrideValue?: string | null;
      isOverridden: boolean;
    }
  >;
  previewDirty: boolean;
  previewStatus?: "DIRTY" | "RENDERING" | "READY" | "FAILED";
  previewGeneratedAt?: string | null;
  previewVersion?: number;
  previewUrl?: string | null;
  previewWidth?: number | null;
  previewHeight?: number | null;
  previewError?: string | null;
  exportStatus?: "EXPORTING" | "EXPORTED" | "FAILED";
  exportUrlJpg?: string | null;
  exportUrlPdf?: string | null;
  exportWidth?: number | null;
  exportHeight?: number | null;
  exportGeneratedAt?: string | null;
  exportVersion?: number;
  exportError?: string | null;
};

type EditorActionResult = { ok: boolean; error?: string; httpStatus?: number };

function ensureSlotAssignmentExists(
  data: EditorDataJson,
  slotId: number
): EditorActionResult {
  const exists = data.assignments.some((a) => a.slotId === slotId);
  if (!exists) {
    return { ok: false, error: "slot_not_in_revision", httpStatus: 400 };
  }
  return { ok: true };
}

function ensureSelectionPhotoAllowed(
  allowedSelectionIds: Set<number>,
  selectionPhotoId: number
): EditorActionResult {
  if (!allowedSelectionIds.has(selectionPhotoId)) {
    return { ok: false, error: "photo_not_in_selection", httpStatus: 400 };
  }
  return { ok: true };
}

export function swapSlotPhotosInData(
  data: EditorDataJson,
  slotIdA: number,
  slotIdB: number
): EditorActionResult {
  const a = data.assignments.find((x) => x.slotId === slotIdA);
  const b = data.assignments.find((x) => x.slotId === slotIdB);
  if (!a || !b) {
    return { ok: false, error: "slot_not_in_revision", httpStatus: 400 };
  }
  const tmpId = a.selectionPhotoId;
  const tmpRole = a.selectionPhotoRole;
  a.selectionPhotoId = b.selectionPhotoId;
  a.selectionPhotoRole = b.selectionPhotoRole;
  b.selectionPhotoId = tmpId;
  b.selectionPhotoRole = tmpRole;
  data.previewDirty = true;
  data.previewStatus = "DIRTY";
  return { ok: true };
}

export function replaceSlotPhotoInData(
  data: EditorDataJson,
  slotId: number,
  selectionPhotoId: number,
  allowedSelectionIds: Set<number>
): EditorActionResult {
  const slotCheck = ensureSlotAssignmentExists(data, slotId);
  if (!slotCheck.ok) return slotCheck;
  const photoCheck = ensureSelectionPhotoAllowed(allowedSelectionIds, selectionPhotoId);
  if (!photoCheck.ok) return photoCheck;
  const target = data.assignments.find((a) => a.slotId === slotId);
  if (!target) return { ok: false, error: "slot_not_in_revision", httpStatus: 400 };
  target.selectionPhotoId = selectionPhotoId;
  const used = new Set(data.assignments.map((a) => a.selectionPhotoId));
  data.unassignedSelectionPhotoIds = Array.from(allowedSelectionIds).filter((id) => !used.has(id));
  data.previewDirty = true;
  data.previewStatus = "DIRTY";
  return { ok: true };
}

export function updateTextOverrideInData(
  data: EditorDataJson,
  textFieldId: string,
  overrideValue: string | null
): EditorActionResult {
  if (!textFieldId.trim()) return { ok: false, error: "invalid_text_field", httpStatus: 400 };
  const current = data.textOverrides[textFieldId] ?? { isOverridden: false };
  data.textOverrides[textFieldId] = {
    ...current,
    overrideValue,
    isOverridden: overrideValue != null && overrideValue.trim() !== "",
  };
  data.previewDirty = true;
  data.previewStatus = "DIRTY";
  return { ok: true };
}

export function clearTextOverrideInData(
  data: EditorDataJson,
  textFieldId: string
): EditorActionResult {
  if (!textFieldId.trim()) return { ok: false, error: "invalid_text_field", httpStatus: 400 };
  delete data.textOverrides[textFieldId];
  data.previewDirty = true;
  data.previewStatus = "DIRTY";
  return { ok: true };
}

export function normalizeEditorDataJson(
  raw: Prisma.JsonValue | null,
  defaults: { templateId: number | null; orderItemId: number | null }
): EditorDataJson {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return {
      schemaVersion: typeof obj.schemaVersion === "number" ? obj.schemaVersion : 3,
      templateId: typeof obj.templateId === "number" ? obj.templateId : defaults.templateId,
      orderItemId: typeof obj.orderItemId === "number" ? obj.orderItemId : defaults.orderItemId,
      assignments: Array.isArray(obj.assignments) ? (obj.assignments as EditorDataJson["assignments"]) : [],
      unassignedSelectionPhotoIds: Array.isArray(obj.unassignedSelectionPhotoIds)
        ? (obj.unassignedSelectionPhotoIds as number[])
        : [],
      unfilledRequiredSlotIds: Array.isArray(obj.unfilledRequiredSlotIds)
        ? (obj.unfilledRequiredSlotIds as number[])
        : [],
      preflight: obj.preflight,
      slotOverrides:
        obj.slotOverrides && typeof obj.slotOverrides === "object" && !Array.isArray(obj.slotOverrides)
          ? (obj.slotOverrides as EditorDataJson["slotOverrides"])
          : {},
      textOverrides:
        obj.textOverrides && typeof obj.textOverrides === "object" && !Array.isArray(obj.textOverrides)
          ? (obj.textOverrides as EditorDataJson["textOverrides"])
          : {},
      previewDirty: Boolean(obj.previewDirty),
      previewStatus:
        obj.previewStatus === "DIRTY" ||
        obj.previewStatus === "RENDERING" ||
        obj.previewStatus === "READY" ||
        obj.previewStatus === "FAILED"
          ? (obj.previewStatus as "DIRTY" | "RENDERING" | "READY" | "FAILED")
          : undefined,
      previewGeneratedAt:
        typeof obj.previewGeneratedAt === "string" ? obj.previewGeneratedAt : null,
      previewVersion: typeof obj.previewVersion === "number" ? obj.previewVersion : undefined,
      previewUrl: typeof obj.previewUrl === "string" ? obj.previewUrl : null,
      previewWidth: typeof obj.previewWidth === "number" ? obj.previewWidth : null,
      previewHeight: typeof obj.previewHeight === "number" ? obj.previewHeight : null,
      previewError: typeof obj.previewError === "string" ? obj.previewError : null,
      exportStatus:
        obj.exportStatus === "EXPORTING" ||
        obj.exportStatus === "EXPORTED" ||
        obj.exportStatus === "FAILED"
          ? (obj.exportStatus as "EXPORTING" | "EXPORTED" | "FAILED")
          : undefined,
      exportUrlJpg: typeof obj.exportUrlJpg === "string" ? obj.exportUrlJpg : null,
      exportUrlPdf: typeof obj.exportUrlPdf === "string" ? obj.exportUrlPdf : null,
      exportWidth: typeof obj.exportWidth === "number" ? obj.exportWidth : null,
      exportHeight: typeof obj.exportHeight === "number" ? obj.exportHeight : null,
      exportGeneratedAt:
        typeof obj.exportGeneratedAt === "string" ? obj.exportGeneratedAt : null,
      exportVersion: typeof obj.exportVersion === "number" ? obj.exportVersion : undefined,
      exportError: typeof obj.exportError === "string" ? obj.exportError : null,
    };
  }
  return {
    schemaVersion: 3,
    templateId: defaults.templateId,
    orderItemId: defaults.orderItemId,
    assignments: [],
    unassignedSelectionPhotoIds: [],
    unfilledRequiredSlotIds: [],
    preflight: undefined,
    slotOverrides: {},
    textOverrides: {},
    previewDirty: false,
    previewStatus: undefined,
    previewGeneratedAt: null,
    previewVersion: undefined,
    previewUrl: null,
    previewWidth: null,
    previewHeight: null,
    previewError: null,
    exportStatus: undefined,
    exportUrlJpg: null,
    exportUrlPdf: null,
    exportWidth: null,
    exportHeight: null,
    exportGeneratedAt: null,
    exportVersion: undefined,
    exportError: null,
  };
}

export async function loadDesignProjectEditorContext(designProjectId: number) {
  return prisma.designProject.findUnique({
    where: { id: designProjectId },
    select: {
      id: true,
      status: true,
      orderItemId: true,
      templateId: true,
      currentRevisionId: true,
      orderItem: {
        select: {
          order: {
            select: {
              studentFirstName: true,
              studentLastName: true,
              schoolCourse: { select: { name: true, division: true } },
              album: {
                select: {
                  id: true,
                  title: true,
                  publicSlug: true,
                  userId: true,
                  school: { select: { id: true, name: true } },
                },
              },
            },
          },
          selection: {
            select: {
              photos: {
                select: {
                  id: true,
                  role: true,
                  position: true,
                  photo: { select: { id: true, previewUrl: true, originalKey: true, isRemoved: true } },
                },
                orderBy: [{ position: "asc" }, { id: "asc" }],
              },
            },
          },
        },
      },
      template: {
        select: {
          id: true,
          imageUrl: true,
          widthCm: true,
          heightCm: true,
          textElementsJson: true,
          pagesJson: true,
          slots: { select: { id: true, role: true, pageIndex: true, index: true, bbox: true } },
        },
      },
      revisions: {
        select: { id: true, dataJson: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
}

export async function updateDesignRevisionDataJson(
  revisionId: number,
  next: EditorDataJson,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  await client.designRevision.update({
    where: { id: revisionId },
    data: { dataJson: next as unknown as Prisma.InputJsonValue },
  });
}
