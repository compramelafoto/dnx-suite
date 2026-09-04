import type { Prisma } from "@/lib/prisma";
import type { PreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";

/**
 * Estados del ítem escolar previos al diseño.
 *
 * Nada en el sistema escribe `WAITING_UPLOAD`, `APPROVED_BY_MATCH` ni `WAITING_SELECTION`: los
 * ítems nacen en `WAITING_SELFIE` y se quedan ahí. Por eso la compuerta que pasaba a
 * `READY_TO_DESIGN` no puede exigir un estado puntual —solo lo cumplían los fixtures de test— y
 * acepta cualquiera de los previos.
 */
export const PRE_DESIGN_ITEM_STATUSES = [
  "WAITING_SELFIE",
  "WAITING_UPLOAD",
  "APPROVED_BY_MATCH",
  "WAITING_SELECTION",
] as const;

export type DesignTemplateSource =
  | "PACK_REQUIRED"
  | "ALBUM_PRODUCT_DEFAULT"
  | "NONE"
  | "AMBIGUOUS";

export type DesignTemplateResolution = {
  source: DesignTemplateSource;
  templateId: number | null;
  /** Beneficios del pack que exigen esta plantilla (vacío si no viene del pack). */
  benefitStableKeys: string[];
  reason?: string;
};

type TemplateValidationResult = {
  isValid: boolean;
  expectedCount: number;
  selectedCount: number;
  missingRoles: string[];
  duplicateRoles: string[];
  unknownRoles: string[];
  reason?: string;
};

type TemplateSlotRow = {
  id: number;
  role: string | null;
  pageIndex?: number | null;
  index?: number | null;
  bbox: unknown;
};

export type TemplateRow = {
  id: number;
  slots: TemplateSlotRow[];
};

type SlotAssignment = {
  slotId: number;
  slotRole: string | null;
  selectionPhotoId: number;
  selectionPhotoRole: string | null;
  source: "ROLE_MATCH" | "ORDER_FALLBACK";
};

type SlotAssignmentResult = {
  isValid: boolean;
  assignments: SlotAssignment[];
  unassignedSelectionPhotoIds: number[];
  unfilledRequiredSlotIds: number[];
  reason?: string;
};

type RenderPreflightResult = {
  isValid: boolean;
  slotRenderData: Array<{
    slotId: number;
    selectionPhotoId: number;
    fitMode: "COVER";
    x: number;
    y: number;
    scale: number;
    rotation: number;
    bbox: { x: number; y: number; width: number; height: number } | null;
  }>;
  warnings: string[];
  errors: string[];
  reason?: string;
};

function resolveDesignTemplateForRedeemItem(
  snapshot: PreventaPackSnapshotV1,
  item: {
    albumProduct?: { requiresDesign: boolean; defaultTemplateId: number | null } | null;
  } | null
): DesignTemplateResolution {
  const requiredBenefits = [...snapshot.benefits]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((b) => b.templatePolicy === "REQUIRED");
  if (requiredBenefits.length > 0) {
    const templateIds = requiredBenefits.map((b) => b.templateId).filter((id): id is number => !!id);
    if (templateIds.length !== requiredBenefits.length) {
      return {
        source: "NONE",
        templateId: null,
        benefitStableKeys: [],
        reason: "required_template_missing",
      };
    }
    const unique = new Set(templateIds);
    if (unique.size !== 1) {
      return {
        source: "AMBIGUOUS",
        templateId: null,
        benefitStableKeys: [],
        reason: "multiple_required_templates",
      };
    }
    return {
      source: "PACK_REQUIRED",
      templateId: templateIds[0],
      benefitStableKeys: requiredBenefits.map((b) => b.stableKey),
    };
  }

  const productRequiresDesign = item?.albumProduct?.requiresDesign === true;
  const productTemplateId = item?.albumProduct?.defaultTemplateId ?? null;
  if (productRequiresDesign && productTemplateId) {
    return {
      source: "ALBUM_PRODUCT_DEFAULT",
      templateId: productTemplateId,
      benefitStableKeys: [],
    };
  }

  if (productRequiresDesign && !productTemplateId) {
    return {
      source: "NONE",
      templateId: null,
      benefitStableKeys: [],
      reason: "album_product_template_missing",
    };
  }

  return { source: "NONE", templateId: null, benefitStableKeys: [], reason: "no_design_required" };
}

function validateSelectionAgainstTemplate(
  template: TemplateRow,
  selectionPhotos: Array<{ id: number; role: string | null }>
): TemplateValidationResult {
  const selectedCount = selectionPhotos.length;
  const slotRoles = template.slots.map((s) => s.role).filter(Boolean) as string[];
  const requiresRoles = slotRoles.length > 0;
  const expectedCount = template.slots.length > 0 ? template.slots.length : selectedCount;

  if (!requiresRoles) {
    const ok = selectedCount >= expectedCount;
    return {
      isValid: ok,
      expectedCount,
      selectedCount,
      missingRoles: [],
      duplicateRoles: [],
      unknownRoles: [],
      reason: ok ? undefined : "selection_count_insufficient",
    };
  }

  const expectedRoles = new Set(slotRoles);
  const seen = new Set<string>();
  const missingRoles: string[] = [];
  const duplicateRoles: string[] = [];
  const unknownRoles: string[] = [];

  for (const sp of selectionPhotos) {
    if (!sp.role) continue;
    if (!expectedRoles.has(sp.role)) {
      unknownRoles.push(sp.role);
      continue;
    }
    if (seen.has(sp.role)) {
      duplicateRoles.push(sp.role);
      continue;
    }
    seen.add(sp.role);
  }

  for (const role of expectedRoles) {
    if (!seen.has(role)) missingRoles.push(role);
  }

  const ok = missingRoles.length === 0 && duplicateRoles.length === 0 && unknownRoles.length === 0;
  return {
    isValid: ok,
    expectedCount,
    selectedCount,
    missingRoles,
    duplicateRoles,
    unknownRoles,
    reason: ok ? undefined : "selection_roles_invalid",
  };
}

function buildInitialTemplateSlotAssignments(
  template: { id: number; slots: Array<{ id: number; role: string | null; pageIndex?: number | null; index?: number | null }> },
  selectionPhotos: Array<{ id: number; role: string | null; position?: number | null }>
): SlotAssignmentResult {
  const slots = [...template.slots].sort((a, b) => {
    const pa = a.pageIndex ?? 0;
    const pb = b.pageIndex ?? 0;
    if (pa !== pb) return pa - pb;
    const ia = a.index ?? 0;
    const ib = b.index ?? 0;
    if (ia !== ib) return ia - ib;
    return a.id - b.id;
  });
  const photos = [...selectionPhotos].sort((a, b) => {
    const pa = a.position ?? 0;
    const pb = b.position ?? 0;
    if (pa !== pb) return pa - pb;
    return a.id - b.id;
  });

  const assignments: SlotAssignment[] = [];
  const usedPhotoIds = new Set<number>();
  const unfilledRequiredSlotIds: number[] = [];
  const unassignedSelectionPhotoIds: number[] = [];

  const hasSlotRoles = slots.some((s) => s.role);
  if (hasSlotRoles) {
    const photosByRole = new Map<string, Array<{ id: number; role: string | null }>>();
    for (const p of photos) {
      if (!p.role) continue;
      const list = photosByRole.get(p.role) ?? [];
      list.push(p);
      photosByRole.set(p.role, list);
    }
    for (const slot of slots) {
      if (slot.role) {
        const list = photosByRole.get(slot.role) ?? [];
        const candidate = list.find((p) => !usedPhotoIds.has(p.id));
        if (candidate) {
          usedPhotoIds.add(candidate.id);
          assignments.push({
            slotId: slot.id,
            slotRole: slot.role,
            selectionPhotoId: candidate.id,
            selectionPhotoRole: candidate.role,
            source: "ROLE_MATCH",
          });
          continue;
        }
        unfilledRequiredSlotIds.push(slot.id);
      }
    }
  }

  for (const slot of slots) {
    const alreadyAssigned = assignments.some((a) => a.slotId === slot.id);
    if (alreadyAssigned) continue;
    const next = photos.find((p) => !usedPhotoIds.has(p.id));
    if (!next) {
      unfilledRequiredSlotIds.push(slot.id);
      continue;
    }
    usedPhotoIds.add(next.id);
    assignments.push({
      slotId: slot.id,
      slotRole: slot.role ?? null,
      selectionPhotoId: next.id,
      selectionPhotoRole: next.role ?? null,
      source: "ORDER_FALLBACK",
    });
  }

  for (const p of photos) {
    if (!usedPhotoIds.has(p.id)) {
      unassignedSelectionPhotoIds.push(p.id);
    }
  }

  const ok = unfilledRequiredSlotIds.length === 0;
  return {
    isValid: ok,
    assignments,
    unassignedSelectionPhotoIds,
    unfilledRequiredSlotIds,
    reason: ok ? undefined : "slots_missing_photos",
  };
}

function parseBbox(raw: unknown): { x: number; y: number; width: number; height: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const box = raw as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  const x = typeof box.x === "number" ? box.x : null;
  const y = typeof box.y === "number" ? box.y : null;
  const width = typeof box.width === "number" ? box.width : null;
  const height = typeof box.height === "number" ? box.height : null;
  if (x == null || y == null || width == null || height == null) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function buildInitialRenderPreflight(
  template: {
    id: number;
    slots: Array<{ id: number; role: string | null; bbox: unknown }>;
  },
  mapping: SlotAssignmentResult,
  selectionPhotos: Array<{
    id: number;
    role?: string | null;
    position?: number | null;
    photo?: { previewUrl?: string | null; originalKey?: string | null; isRemoved?: boolean } | null;
  }>
): RenderPreflightResult {
  const slotIds = new Set(template.slots.map((s) => s.id));
  const slotById = new Map(template.slots.map((s) => [s.id, s] as const));
  const photoBySelectionId = new Map(selectionPhotos.map((p) => [p.id, p] as const));
  const warnings: string[] = [];
  const errors: string[] = [];
  const slotRenderData: RenderPreflightResult["slotRenderData"] = [];

  for (const assignment of mapping.assignments) {
    if (!slotIds.has(assignment.slotId)) {
      errors.push(`invalid_slot_assignment:${assignment.slotId}`);
      continue;
    }
    const sel = photoBySelectionId.get(assignment.selectionPhotoId);
    if (!sel) {
      errors.push(`missing_selection_photo:${assignment.selectionPhotoId}`);
      continue;
    }
    if (sel.photo?.isRemoved) {
      errors.push(`selection_photo_removed:${assignment.selectionPhotoId}`);
      continue;
    }
    const hasAsset =
      typeof sel.photo?.previewUrl === "string" && sel.photo.previewUrl.trim() !== ""
        ? true
        : typeof sel.photo?.originalKey === "string" && sel.photo.originalKey.trim() !== "";
    if (!hasAsset) {
      warnings.push(`missing_asset:${assignment.selectionPhotoId}`);
    }

    const slot = slotById.get(assignment.slotId);
    const bbox = parseBbox(slot?.bbox);
    if (!bbox) {
      errors.push(`slot_bbox_missing:${assignment.slotId}`);
      continue;
    }

    slotRenderData.push({
      slotId: assignment.slotId,
      selectionPhotoId: assignment.selectionPhotoId,
      fitMode: "COVER",
      x: bbox.x,
      y: bbox.y,
      scale: 1,
      rotation: 0,
      bbox,
    });
  }

  const ok = errors.length === 0;
  return {
    isValid: ok,
    slotRenderData,
    warnings,
    errors,
    reason: ok ? undefined : "preflight_failed",
  };
}

function buildRevisionDataJson(params: {
  templateId: number;
  orderItemId: number;
  assignments: SlotAssignment[];
  unassignedSelectionPhotoIds: number[];
  unfilledRequiredSlotIds: number[];
  preflight: RenderPreflightResult;
  existingData?: Prisma.JsonValue | null;
}): Prisma.InputJsonValue {
  const base = {
    schemaVersion: 3,
    templateId: params.templateId,
    orderItemId: params.orderItemId,
    assignments: params.assignments,
    unassignedSelectionPhotoIds: params.unassignedSelectionPhotoIds,
    unfilledRequiredSlotIds: params.unfilledRequiredSlotIds,
    preflight: params.preflight,
    slotOverrides: {},
    textOverrides: {},
    previewDirty: false,
  };
  const existing = params.existingData;
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return { ...(existing as Record<string, unknown>), ...base };
  }
  return base;
}

/**
 * Fotos que van al diseño.
 *
 * Cuando la plantilla la exige un beneficio del pack, solo entran las fotos que la familia eligió
 * PARA ESE beneficio. Si entraran todas, las fotos digitales podrían ocupar los huecos del impreso
 * (se asignan por orden de posición) y la carpeta se imprimiría con las fotos equivocadas.
 *
 * Devuelve lista vacía cuando hay fotos permitidas pero ninguna coincide: es preferible no generar
 * el diseño a generarlo con las fotos que no son.
 */
export function pickSelectionPhotosForDesign<T extends { photoId?: number | null }>(
  selectionPhotos: T[],
  resolution: Pick<DesignTemplateResolution, "source" | "benefitStableKeys">,
  photoIdsByBenefitKey: Map<string, number[]> | null | undefined
): T[] {
  if (resolution.source !== "PACK_REQUIRED") return selectionPhotos;
  if (!photoIdsByBenefitKey) return selectionPhotos;

  const permitidas = new Set<number>();
  for (const key of resolution.benefitStableKeys) {
    for (const photoId of photoIdsByBenefitKey.get(key) ?? []) permitidas.add(photoId);
  }
  if (permitidas.size === 0) return selectionPhotos;

  return selectionPhotos.filter((p) => p.photoId != null && permitidas.has(p.photoId));
}

export type EnsureSchoolDesignForPreCompraOrderItemResult =
  | { outcome: "created"; designProjectId: number }
  | { outcome: "skipped"; reason: string };

export type EnsureSchoolDesignForPreCompraOrderItemParams = {
  snapshot: PreventaPackSnapshotV1;
  orderItem: {
    id: number;
    albumProduct: { requiresDesign: boolean; defaultTemplateId: number | null } | null;
  };
  selectionPhotos: Array<{
    id: number;
    role: string | null;
    position?: number | null;
    /** Foto del álbum. Necesario para separar las fotos por beneficio. */
    photoId?: number | null;
    photo?: { previewUrl?: string | null; originalKey?: string | null; isRemoved?: boolean } | null;
  }>;
  /** Fotos elegidas por la familia para cada beneficio del pack (clave estable → photoIds). */
  photoIdsByBenefitKey?: Map<string, number[]> | null;
  /** Opcional: cache por templateId dentro del mismo redeem (misma semántica que antes). */
  templateCache?: Map<number, TemplateRow | null>;
};

export async function ensureSchoolDesignForPreCompraOrderItem(
  tx: Prisma.TransactionClient,
  params: EnsureSchoolDesignForPreCompraOrderItemParams
): Promise<EnsureSchoolDesignForPreCompraOrderItemResult> {
  const { snapshot, orderItem, selectionPhotos } = params;
  const templateCache = params.templateCache ?? new Map<number, TemplateRow | null>();

  const resolution = resolveDesignTemplateForRedeemItem(snapshot, orderItem);
  if (resolution.source === "AMBIGUOUS") {
    console.warn("[school_redeem_design_gate] template_ambiguous", {
      orderItemId: orderItem.id,
      reason: resolution.reason,
    });
    return { outcome: "skipped", reason: `template_ambiguous:${resolution.reason ?? ""}` };
  }
  if (resolution.source === "NONE" || !resolution.templateId) {
    console.info("[school_redeem_design_gate] template_missing", {
      orderItemId: orderItem.id,
      reason: resolution.reason,
    });
    return { outcome: "skipped", reason: `template_missing:${resolution.reason ?? "none"}` };
  }

  console.info("[school_redeem_design_gate] template_resolved", {
    orderItemId: orderItem.id,
    templateId: resolution.templateId,
    source: resolution.source,
  });

  // Solo las fotos del beneficio que exige la plantilla; ver pickSelectionPhotosForDesign.
  const fotosDelDiseno = pickSelectionPhotosForDesign(
    selectionPhotos,
    resolution,
    params.photoIdsByBenefitKey
  );
  if (fotosDelDiseno.length === 0) {
    console.warn("[school_redeem_design_gate] no_photos_for_template", {
      orderItemId: orderItem.id,
      templateId: resolution.templateId,
      benefitStableKeys: resolution.benefitStableKeys,
      selectedCount: selectionPhotos.length,
    });
    return { outcome: "skipped", reason: "no_photos_for_template" };
  }
  if (fotosDelDiseno.length !== selectionPhotos.length) {
    console.info("[school_redeem_design_gate] photos_scoped_to_benefit", {
      orderItemId: orderItem.id,
      benefitStableKeys: resolution.benefitStableKeys,
      elegidas: selectionPhotos.length,
      paraElDiseno: fotosDelDiseno.length,
    });
  }

  let template = templateCache.get(resolution.templateId) ?? null;
  if (!template) {
    template = await tx.template.findUnique({
      where: { id: resolution.templateId },
      select: {
        id: true,
        slots: { select: { id: true, role: true, pageIndex: true, index: true, bbox: true } },
      },
    });
    templateCache.set(resolution.templateId, template);
  }
  if (!template) {
    console.warn("[school_redeem_design_gate] template_not_found", {
      orderItemId: orderItem.id,
      templateId: resolution.templateId,
    });
    return { outcome: "skipped", reason: "template_not_found" };
  }

  const validation = validateSelectionAgainstTemplate(template, fotosDelDiseno);
  if (!validation.isValid) {
    console.warn("[school_redeem_design_gate] validation_failed", {
      orderItemId: orderItem.id,
      templateId: template.id,
      selectedCount: validation.selectedCount,
      expectedCount: validation.expectedCount,
      missingRoles: validation.missingRoles,
      duplicateRoles: validation.duplicateRoles,
      unknownRoles: validation.unknownRoles,
      reason: validation.reason,
    });
    return { outcome: "skipped", reason: `validation_failed:${validation.reason ?? ""}` };
  }

  console.info("[school_redeem_design_gate] validation_ok", {
    orderItemId: orderItem.id,
    templateId: template.id,
    selectedCount: validation.selectedCount,
    expectedCount: validation.expectedCount,
  });

  if (validation.selectedCount > validation.expectedCount) {
    console.warn("[school_redeem_design_gate] selection_photos_exceed_slots", {
      orderItemId: orderItem.id,
      templateId: template.id,
      selectedCount: validation.selectedCount,
      expectedCount: validation.expectedCount,
    });
  }

  const existingProject = await tx.designProject.findUnique({
    where: { orderItemId: orderItem.id },
    select: { id: true },
  });
  let designProjectId = existingProject?.id ?? null;
  if (!designProjectId) {
    const created = await tx.designProject.create({
      data: {
        orderItemId: orderItem.id,
        templateId: template.id,
      },
      select: { id: true },
    });
    designProjectId = created.id;
    console.info("[school_redeem_design_gate] design_project_created", {
      orderItemId: orderItem.id,
      templateId: template.id,
    });
  }

  const updated = await tx.preCompraOrderItem.updateMany({
    where: { id: orderItem.id, status: { in: [...PRE_DESIGN_ITEM_STATUSES] } },
    data: { status: "READY_TO_DESIGN", approvalProof: "SELECTION", approvedAt: new Date() },
  });
  if (updated.count > 0) {
    console.info("[school_redeem_design_gate] status_ready_to_design", {
      orderItemId: orderItem.id,
    });
  }

  if (!designProjectId) {
    console.warn("[school_redeem_design_revision] skipped_revision_creation", {
      orderItemId: orderItem.id,
      reason: "design_project_missing",
    });
    return { outcome: "skipped", reason: "design_project_missing" };
  }

  const mapping = buildInitialTemplateSlotAssignments(template, fotosDelDiseno);

  if (!mapping.isValid) {
    console.warn("[school_redeem_design_revision] mapping_failed", {
      orderItemId: orderItem.id,
      designProjectId,
      reason: mapping.reason,
      unfilledRequiredSlotIds: mapping.unfilledRequiredSlotIds,
      unassignedSelectionPhotoIds: mapping.unassignedSelectionPhotoIds,
    });
    return { outcome: "skipped", reason: `mapping_failed:${mapping.reason ?? ""}` };
  }

  console.info("[school_redeem_design_revision] mapping_built", {
    orderItemId: orderItem.id,
    designProjectId,
    assignments: mapping.assignments.length,
    unassignedSelectionPhotoIds: mapping.unassignedSelectionPhotoIds.length,
  });

  const renderStart = await tx.designProject.updateMany({
    where: {
      id: designProjectId,
      status: { in: ["DRAFT", "NEEDS_ADJUSTMENT"] },
    },
    data: { status: "DRAFT_RENDERING" },
  });
  if (renderStart.count > 0) {
    console.info("[school_design_review] preview_render_started", {
      orderItemId: orderItem.id,
      designProjectId,
    });
  }
  console.info("[school_redeem_render_preflight] preflight_started", {
    orderItemId: orderItem.id,
    designProjectId,
  });

  const preflight = buildInitialRenderPreflight(template, mapping, fotosDelDiseno);
  if (!preflight.isValid) {
    console.warn("[school_redeem_render_preflight] preflight_failed", {
      orderItemId: orderItem.id,
      designProjectId,
      errors: preflight.errors,
      warnings: preflight.warnings,
      reason: preflight.reason,
    });
    if (preflight.errors.some((e) => e.startsWith("invalid_slot_assignment:"))) {
      console.warn("[school_redeem_render_preflight] invalid_slot_assignment", {
        orderItemId: orderItem.id,
        designProjectId,
      });
    }
    return { outcome: "skipped", reason: `preflight_failed:${preflight.reason ?? ""}` };
  }

  if (preflight.warnings.length > 0) {
    console.warn("[school_redeem_render_preflight] preflight_warning", {
      orderItemId: orderItem.id,
      designProjectId,
      warnings: preflight.warnings,
    });
    if (preflight.warnings.some((w) => w.startsWith("missing_asset:"))) {
      console.warn("[school_redeem_render_preflight] missing_asset", {
        orderItemId: orderItem.id,
        designProjectId,
      });
    }
  }

  console.info("[school_redeem_render_preflight] preflight_ok", {
    orderItemId: orderItem.id,
    designProjectId,
    slotRenderData: preflight.slotRenderData.length,
  });

  const project = await tx.designProject.findUnique({
    where: { id: designProjectId },
    select: {
      currentRevisionId: true,
      revisions: { select: { id: true, dataJson: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  const existingRevision = project?.revisions?.[0] ?? null;
  const revisionId = existingRevision?.id ?? project?.currentRevisionId ?? null;
  if (revisionId) {
    const dataJson = existingRevision?.dataJson ?? null;
    const alreadyEnriched =
      dataJson &&
      typeof dataJson === "object" &&
      !Array.isArray(dataJson) &&
      (dataJson as { preflight?: unknown }).preflight != null;
    if (alreadyEnriched) {
      console.info("[school_redeem_render_preflight] revision_already_enriched", {
        orderItemId: orderItem.id,
        designProjectId,
        revisionId,
      });
      const statusUpdate = await tx.designProject.updateMany({
        where: {
          id: designProjectId,
          status: { in: ["DRAFT", "DRAFT_RENDERING", "NEEDS_ADJUSTMENT"] },
        },
        data: { status: "PENDING_PHOTOGRAPHER_APPROVAL" },
      });
      if (statusUpdate.count > 0) {
        console.info("[school_design_review] preview_rendered", {
          orderItemId: orderItem.id,
          designProjectId,
        });
      }
      return { outcome: "created", designProjectId };
    }

    const nextData = buildRevisionDataJson({
      templateId: template.id,
      orderItemId: orderItem.id,
      assignments: mapping.assignments,
      unassignedSelectionPhotoIds: mapping.unassignedSelectionPhotoIds,
      unfilledRequiredSlotIds: mapping.unfilledRequiredSlotIds,
      preflight,
      existingData: dataJson,
    });
    await tx.designRevision.update({
      where: { id: revisionId },
      data: { dataJson: nextData },
    });
    console.info("[school_redeem_render_preflight] revision_enriched", {
      orderItemId: orderItem.id,
      designProjectId,
      revisionId,
    });
    const statusUpdate = await tx.designProject.updateMany({
      where: {
        id: designProjectId,
        status: { in: ["DRAFT", "DRAFT_RENDERING", "NEEDS_ADJUSTMENT"] },
      },
      data: { status: "PENDING_PHOTOGRAPHER_APPROVAL" },
    });
    if (statusUpdate.count > 0) {
      console.info("[school_design_review] preview_rendered", {
        orderItemId: orderItem.id,
        designProjectId,
      });
    }
    return { outcome: "created", designProjectId };
  }

  const revision = await tx.designRevision.create({
    data: {
      designProjectId,
      dataJson: buildRevisionDataJson({
        templateId: template.id,
        orderItemId: orderItem.id,
        assignments: mapping.assignments,
        unassignedSelectionPhotoIds: mapping.unassignedSelectionPhotoIds,
        unfilledRequiredSlotIds: mapping.unfilledRequiredSlotIds,
        preflight,
      }),
    },
    select: { id: true },
  });
  await tx.designProject.update({
    where: { id: designProjectId },
    data: { currentRevisionId: revision.id },
  });
  console.info("[school_redeem_render_preflight] design_revision_created", {
    orderItemId: orderItem.id,
    designProjectId,
    revisionId: revision.id,
  });
  const statusUpdate = await tx.designProject.updateMany({
    where: {
      id: designProjectId,
      status: { in: ["DRAFT", "DRAFT_RENDERING", "NEEDS_ADJUSTMENT"] },
    },
    data: { status: "PENDING_PHOTOGRAPHER_APPROVAL" },
  });
  if (statusUpdate.count > 0) {
    console.info("[school_design_review] preview_rendered", {
      orderItemId: orderItem.id,
      designProjectId,
    });
  }
  return { outcome: "created", designProjectId };
}
