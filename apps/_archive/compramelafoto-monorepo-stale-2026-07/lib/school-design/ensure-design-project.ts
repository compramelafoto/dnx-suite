import type { Prisma } from "@prisma/client";
import { DesignPreviewStatus, DesignProjectStatus, PreCompraOrderItemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildInitialRenderPreflight } from "./build-preflight";
import { buildInitialTemplateSlotAssignments } from "./build-slot-assignments";
import type { ParsedRevision } from "./revision-data";
import { serializeRevisionDataJson } from "./revision-data";
import { resolveDesignTemplateForRedeemItem } from "./resolve-design-template";
import { validateSelectionAgainstTemplate } from "./validate-selection";
import type { TemplateSlotInput } from "./validate-selection";

export type EnsureDesignProjectResult =
  | { ok: true; designProjectId: number; created: boolean }
  | { ok: false; code: string; message: string };

/**
 * Idempotente: no duplica DesignProject ni DesignRevision inicial si ya existen.
 * Tras crear revisión con preflight → `PENDING_PHOTOGRAPHER_APPROVAL` (SCHOOL-PIPELINE-SYNC-LOG).
 */
export async function ensureDesignProjectForOrderItem(orderItemId: number): Promise<EnsureDesignProjectResult> {
  const item = await prisma.preCompraOrderItem.findUnique({
    where: { id: orderItemId },
    include: {
      albumProduct: { include: { templates: true, defaultTemplate: true } },
      selection: {
        include: {
          photos: {
            include: {
              photo: { include: { photoFaces: { take: 1 } } },
            },
          },
        },
      },
      order: { include: { album: true } },
      designProject: { include: { currentRevision: true } },
    },
  });

  if (!item) {
    return { ok: false, code: "NOT_FOUND", message: "Ítem no encontrado" };
  }

  if (item.status !== PreCompraOrderItemStatus.READY_TO_DESIGN) {
    return {
      ok: false,
      code: "INVALID_ORDER_ITEM_STATUS",
      message: "El ítem debe estar en READY_TO_DESIGN",
    };
  }

  if (!item.selection?.photos?.length) {
    console.warn("[school_redeem_design_gate] no selection photos", { orderItemId });
    return { ok: false, code: "NO_SELECTION", message: "No hay selección persistida" };
  }

  const livePhotos = item.selection.photos.filter((sp) => !sp.photo.isRemoved);
  if (livePhotos.length !== item.selection.photos.length) {
    console.warn("[school_redeem_design_gate] selection contains removed photos", { orderItemId });
    return { ok: false, code: "SELECTION_INVALID", message: "La selección incluye fotos removidas" };
  }

  const productTemplateIds = item.albumProduct.templates.map((t) => t.id);
  const resolution = resolveDesignTemplateForRedeemItem({
    requiresDesign: item.albumProduct.requiresDesign,
    defaultTemplateId: item.albumProduct.defaultTemplateId,
    productTemplateIds,
  });

  if (resolution.outcome === "NONE_NO_DESIGN") {
    console.warn("[school_redeem_design_gate] no design required", { orderItemId });
    return { ok: false, code: "NO_DESIGN_REQUIRED", message: "Este producto no requiere diseño" };
  }

  if (resolution.outcome === "PACK_REQUIRED") {
    console.warn("[school_redeem_design_gate] PACK_REQUIRED", { orderItemId });
    return { ok: false, code: "PACK_REQUIRED", message: "Falta plantilla en el pack" };
  }

  if (resolution.outcome === "AMBIGUOUS") {
    console.warn("[school_redeem_design_gate] AMBIGUOUS", { orderItemId, resolution });
    return { ok: false, code: "AMBIGUOUS", message: "Plantilla ambigua; definí una por defecto" };
  }

  if (resolution.outcome === "NONE_REQUIRED_MISSING") {
    console.warn("[school_redeem_design_gate] NONE_REQUIRED_MISSING", { orderItemId, resolution });
    return { ok: false, code: "TEMPLATE_INVALID", message: resolution.reason };
  }

  const templateId = resolution.templateId;

  const template = await prisma.template.findFirst({
    where: { id: templateId },
    include: { slots: true },
  });

  if (!template) {
    console.warn("[school_redeem_design_gate] template missing", { templateId, orderItemId });
    return { ok: false, code: "TEMPLATE_MISSING", message: "Plantilla no encontrada" };
  }

  const slots: TemplateSlotInput[] = template.slots.map((s) => ({
    id: s.id,
    pageIndex: s.pageIndex,
    index: s.index,
    role: s.role,
    bbox: s.bbox,
  }));

  const selectionPhotosInput = item.selection.photos.map((sp) => ({
    photoId: sp.photoId,
    role: sp.role ?? null,
    position: sp.position,
  }));

  const v = validateSelectionAgainstTemplate({
    slots,
    selectionPhotos: selectionPhotosInput,
    minFotos: item.albumProduct.minFotos,
    maxFotos: item.albumProduct.maxFotos,
  });

  if (!v.ok) {
    console.warn("[school_redeem_design_gate] selection invalid", { orderItemId, v });
    return { ok: false, code: "SELECTION_INVALID", message: "Selección incompleta o roles inválidos para la plantilla" };
  }

  const photoMeta = item.selection.photos.map((sp) => ({
    id: sp.photoId,
    position: sp.position,
    role: sp.role ?? null,
  }));

  const { assignments, unassignedSelectionPhotoIds, unfilledRequiredSlotIds } =
    buildInitialTemplateSlotAssignments({
      slots: v.slotsOrdered,
      selectionPhotos: photoMeta,
    });

  if (unfilledRequiredSlotIds.length > 0) {
    console.warn("[school_redeem_design_gate] unfilled slots after mapping", { orderItemId, unfilledRequiredSlotIds });
    return { ok: false, code: "SELECTION_INVALID", message: "No se pudieron rellenar todos los slots" };
  }

  const photoBboxByPhotoId = new Map<number, { x: number; y: number; width: number; height: number } | null>();
  for (const sp of item.selection.photos) {
    const face = sp.photo.photoFaces[0];
    const raw = face?.bbox;
    if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      const x = Number(o.x);
      const y = Number(o.y);
      const width = Number(o.width);
      const height = Number(o.height);
      if ([x, y, width, height].every((n) => Number.isFinite(n))) {
        photoBboxByPhotoId.set(sp.photoId, { x, y, width, height });
      } else {
        photoBboxByPhotoId.set(sp.photoId, null);
      }
    } else {
      photoBboxByPhotoId.set(sp.photoId, { x: 0, y: 0, width: 1, height: 1 });
    }
  }

  const preflight = buildInitialRenderPreflight({
    slots: v.slotsOrdered,
    assignments,
    photoBboxByPhotoId,
  });

  const roleMap = new Map(item.selection.photos.map((sp) => [sp.photoId, sp.role ?? null]));

  const parsed: ParsedRevision = {
    schemaVersion: 3,
    templateId,
    orderItemId: item.id,
    assignmentsRecord: assignments,
    unassignedSelectionPhotoIds,
    unfilledRequiredSlotIds,
    preflight,
    textOverridesFlat: {},
    textOverridesRaw: {},
    slotTransforms: {},
  };

  const dataJson = serializeRevisionDataJson(parsed, v.slotsOrdered, roleMap, templateId, item.id);

  if (item.designProject && item.designProject.templateId !== templateId) {
    console.warn("[school_redeem_design_revision] template mismatch existing project", {
      orderItemId,
      existing: item.designProject.templateId,
      wanted: templateId,
    });
    return { ok: false, code: "PROJECT_TEMPLATE_MISMATCH", message: "Ya existe un diseño con otra plantilla" };
  }

  if (item.designProject?.currentRevisionId) {
    console.log("[school_redeem_design_revision] idempotent hit", {
      orderItemId,
      designProjectId: item.designProject.id,
    });
    return { ok: true, designProjectId: item.designProject.id, created: false };
  }

  const result = await prisma.$transaction(async (tx) => {
    let designProjectIdNum = item.designProject?.id;
    if (designProjectIdNum == null) {
      const created = await tx.designProject.create({
        data: {
          orderItemId: item.id,
          templateId,
          status: DesignProjectStatus.PENDING_PHOTOGRAPHER_APPROVAL,
          previewDirty: true,
          previewStatus: DesignPreviewStatus.IDLE,
        },
      });
      designProjectIdNum = created.id;
    }

    const existingRev = await tx.designRevision.findFirst({
      where: { designProjectId: designProjectIdNum },
      orderBy: { id: "asc" },
    });

    if (existingRev) {
      await tx.designProject.update({
        where: { id: designProjectIdNum },
        data: { currentRevisionId: existingRev.id },
      });
      return { designProjectId: designProjectIdNum, created: false };
    }

    const rev = await tx.designRevision.create({
      data: {
        designProjectId: designProjectIdNum,
        createdBy: "CLIENT",
        dataJson: dataJson as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.designProject.update({
      where: { id: designProjectIdNum },
      data: {
        currentRevisionId: rev.id,
        status: DesignProjectStatus.PENDING_PHOTOGRAPHER_APPROVAL,
      },
    });

    return { designProjectId: designProjectIdNum, created: true };
  });

  console.log("[school_redeem_design_revision] ensured", {
    orderItemId,
    designProjectId: result.designProjectId,
    created: result.created,
  });

  return { ok: true, designProjectId: result.designProjectId, created: result.created };
}
