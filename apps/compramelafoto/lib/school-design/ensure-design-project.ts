import type { Prisma } from "@prisma/client";
import { DesignPreviewStatus, DesignProjectStatus, PreCompraOrderItemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildInitialRenderPreflight } from "./build-preflight";
import { buildInitialTemplateSlotAssignments } from "./build-slot-assignments";
import { resolveDesignTemplateForRedeemItem } from "./resolve-design-template";
import type { DesignRevisionDataJsonV1 } from "./types";
import { SCHOOL_DESIGN_REVISION_SCHEMA_VERSION } from "./types";
import { validateSelectionAgainstTemplate } from "./validate-selection";
import type { TemplateSlotInput } from "./validate-selection";

export type EnsureDesignProjectResult =
  | { ok: true; designProjectId: number; created: boolean }
  | { ok: false; code: string; message: string };

/**
 * Idempotente: no duplica DesignProject ni DesignRevision inicial si ya existen.
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

  const selectionPhotos = item.selection.photos.map((sp) => ({
    id: sp.photoId,
    position: sp.position,
    role: null as string | null,
  }));

  const orderedIds = [...selectionPhotos]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id)
    .map((p) => p.id);

  const v = validateSelectionAgainstTemplate({
    slots,
    selectionPhotoIdsOrdered: orderedIds,
    minFotos: item.albumProduct.minFotos,
    maxFotos: item.albumProduct.maxFotos,
  });

  if (!v.ok) {
    console.warn("[school_redeem_design_gate] selection invalid", { orderItemId, v });
    return { ok: false, code: "SELECTION_INVALID", message: "Selección incompleta para la plantilla" };
  }

  const photoMeta = selectionPhotos.map((p) => ({
    id: p.id,
    position: p.position,
    role: p.role,
  }));

  const { assignments, unassignedSelectionPhotoIds, unfilledRequiredSlotIds } =
    buildInitialTemplateSlotAssignments({
      slots: v.slotsOrdered,
      selectionPhotos: photoMeta,
    });

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

  const dataJson: DesignRevisionDataJsonV1 = {
    schemaVersion: SCHOOL_DESIGN_REVISION_SCHEMA_VERSION,
    assignments,
    unassignedSelectionPhotoIds,
    unfilledRequiredSlotIds,
    preflight,
    textOverrides: {},
    slotTransforms: {},
  };

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
          status: DesignProjectStatus.DRAFT,
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
        status: DesignProjectStatus.DRAFT,
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
