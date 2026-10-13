import "server-only";
import type { Prisma } from "@/lib/prisma";
import type { PreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { createDesignV2Project } from "@/lib/design-v2/projects";
import { loadDesignTemplateVersion, type DesignTemplateVersion } from "@/lib/design-v2/template";
import { loadCourseStudentList } from "@/lib/design-v2/class-list";
import { buildDesignValues, courseDisplayName } from "@/lib/design-v2/values";
import {
  pickSelectionPhotosForDesign,
  resolveDesignTemplateForRedeem,
} from "./pick-selection-photos-for-design";

export {
  pickSelectionPhotosForDesign,
  resolveDesignTemplateForRedeem,
  type DesignTemplateResolution,
} from "./pick-selection-photos-for-design";

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

/** Lo que el diseño necesita saber del pedido de preventa: quién lo revisa y qué textos lleva. */
export type SchoolDesignContext = {
  albumId: number;
  photographerUserId: number;
  values: Record<string, string>;
};

export async function loadSchoolDesignContext(
  db: Prisma.TransactionClient,
  preCompraOrderId: number,
): Promise<SchoolDesignContext | null> {
  const order = await db.preCompraOrder.findUnique({
    where: { id: preCompraOrderId },
    select: {
      albumId: true,
      buyerName: true,
      studentFirstName: true,
      studentLastName: true,
      studentId: true,
      albumRosterEntryId: true,
      studentLevelSnapshot: true,
      studentShiftSnapshot: true,
      studentCourseSnapshot: true,
      studentDivisionSnapshot: true,
      schoolCourse: { select: { name: true, division: true } },
      album: {
        select: {
          userId: true,
          eventDate: true,
          school: { select: { name: true, logoUrl: true } },
          user: { select: { name: true } },
        },
      },
    },
  });
  if (!order) return null;
  const studentName = [order.studentFirstName, order.studentLastName].filter(Boolean).join(" ");
  const courseStudents = await loadCourseStudentList(db, {
    albumId: order.albumId,
    albumRosterEntryId: order.albumRosterEntryId,
    studentId: order.studentId,
    firstName: order.studentFirstName,
    lastName: order.studentLastName,
    level: order.studentLevelSnapshot,
    shift: order.studentShiftSnapshot,
    courseName: order.studentCourseSnapshot ?? order.schoolCourse?.name,
    division: order.studentDivisionSnapshot ?? order.schoolCourse?.division,
  });
  return {
    albumId: order.albumId,
    photographerUserId: order.album.userId,
    values: buildDesignValues({
      studentName,
      courseName:
        courseDisplayName(order.schoolCourse?.name, order.schoolCourse?.division) ??
        courseDisplayName(order.studentCourseSnapshot, order.studentDivisionSnapshot),
      schoolName: order.album.school?.name,
      schoolLogoUrl: order.album.school?.logoUrl,
      buyerName: order.buyerName,
      photographerName: order.album.user?.name,
      eventDate: order.album.eventDate,
      orderReference: `P-${preCompraOrderId}`,
      courseStudents,
    }),
  };
}

export type EnsureSchoolDesignForPreCompraOrderItemResult =
  | { outcome: "created"; designProjectId: number }
  | { outcome: "skipped"; reason: string };

export type EnsureSchoolDesignForPreCompraOrderItemParams = {
  snapshot: PreventaPackSnapshotV1;
  orderItem: { id: number };
  selectionPhotos: Array<{ id: number; position?: number | null; photoId?: number | null }>;
  /** Fotos elegidas por la familia para cada beneficio del pack (clave estable → photoIds). */
  photoIdsByBenefitKey?: Map<string, number[]> | null;
  context: SchoolDesignContext;
  /** Pedido del canje, donde el cliente ve sus descargas. */
  redemptionOrderId?: number | null;
  /** Cache por plantilla dentro del mismo canje (varios ítems con la misma carpeta). */
  templateCache?: Map<string, DesignTemplateVersion | null>;
};

/**
 * Arma el diseño de un ítem de preventa con la plantilla del diseñador nuevo que exige el pack,
 * y lo deja para que el fotógrafo lo revise.
 */
export async function ensureSchoolDesignForPreCompraOrderItem(
  tx: Prisma.TransactionClient,
  params: EnsureSchoolDesignForPreCompraOrderItemParams,
): Promise<EnsureSchoolDesignForPreCompraOrderItemResult> {
  const { snapshot, orderItem } = params;
  const cache = params.templateCache ?? new Map<string, DesignTemplateVersion | null>();

  const resolution = resolveDesignTemplateForRedeem(snapshot.benefits);
  if (resolution.source === "AMBIGUOUS") {
    console.warn("[school_redeem_design_gate] template_ambiguous", { orderItemId: orderItem.id });
    return { outcome: "skipped", reason: `template_ambiguous:${resolution.reason ?? ""}` };
  }
  if (resolution.source === "NONE" || !resolution.templateV2Id) {
    return { outcome: "skipped", reason: `template_missing:${resolution.reason ?? "none"}` };
  }

  const ordered = [...params.selectionPhotos].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id,
  );
  const photos = pickSelectionPhotosForDesign(ordered, resolution, params.photoIdsByBenefitKey);
  const photoIds = photos.map((p) => p.photoId).filter((id): id is number => typeof id === "number");
  if (photoIds.length === 0) {
    console.warn("[school_redeem_design_gate] no_photos_for_template", { orderItemId: orderItem.id });
    return { outcome: "skipped", reason: "no_photos_for_template" };
  }

  let template = cache.get(resolution.templateV2Id);
  if (template === undefined) {
    template = await loadDesignTemplateVersion({ templateId: resolution.templateV2Id });
    cache.set(resolution.templateV2Id, template);
  }
  if (!template) return { outcome: "skipped", reason: "template_not_found" };
  if (template.slots.length === 0) return { outcome: "skipped", reason: "template_without_photo_slots" };

  const { id } = await createDesignV2Project(tx, {
    template,
    photoIds,
    values: params.context.values,
    photographerUserId: params.context.photographerUserId,
    albumId: params.context.albumId,
    albumOrderId: params.redemptionOrderId ?? null,
    orderItemId: orderItem.id,
  });

  await tx.preCompraOrderItem.updateMany({
    where: { id: orderItem.id, status: { in: [...PRE_DESIGN_ITEM_STATUSES] } },
    data: { status: "READY_TO_DESIGN", approvalProof: "SELECTION", approvedAt: new Date() },
  });

  console.info("[school_redeem_design_gate] design_created", { orderItemId: orderItem.id, designProjectId: id });
  return { outcome: "created", designProjectId: id };
}
