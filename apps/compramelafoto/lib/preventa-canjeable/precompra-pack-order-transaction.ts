import {
  CheckoutPaymentSource,
  OrderOrigin,
  Prisma,
  type Order,
  type PreCompraOrder,
} from "@/lib/prisma";
import {
  buildPreventaPackSnapshotV1,
  scalePreventaPackSnapshotV1ByPackQuantity,
} from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { clientTotalArsFromPhotographerBaseArs } from "@/lib/preventa-canjeable/pack-client-price";
import type { PreventaRequirements } from "@/lib/preventa-canjeable/preventa-mode";
import type { StudentSourceType } from "@/lib/prisma";

export type PackLine = { packDefinitionId: number; priceCents: number; quantity: number };

export type PrecompraPackOrderTransactionContext = {
  albumId: number;
  buyerEmail: string;
  buyerUserId: number | null;
  buyerName: string | null;
  buyerPhone: string | null;
  isSchool: boolean;
  resolvedSchoolCourseId: number | null;
  resolvedStudentFirstName: string | null;
  resolvedStudentLastName: string | null;
  resolvedStudentId: number | null;
  resolvedAlbumRosterEntryId: number | null;
  resolvedStudentSourceType: StudentSourceType | null;
  resolvedLevelSnap: string | null;
  resolvedShiftSnap: string | null;
  resolvedCourseSnap: string | null;
  resolvedDivisionSnap: string | null;
  orderItems: PackLine[];
  packDefinitionId: number;
  packQuantity: number;
  totalCents: number;
  orderTotalArs: number;
  pricingSnapshot: Prisma.InputJsonValue;
  platformPercent: number;
  now: Date;
  isTest: boolean;
  checkoutPaymentSource: CheckoutPaymentSource;
  preventaReqs: PreventaRequirements;
  organizerReferralSchoolId: number | null;
};

/**
 * BRIDGE V1: crea PreCompraOrder + ítems + Subject opcional + Order PREVENTA_PACK.
 * Usado por POST /api/precompra/order y POST /api/precompra/order/test.
 */
export async function createPrecompraPackOrderInTransaction(
  tx: Prisma.TransactionClient,
  ctx: PrecompraPackOrderTransactionContext
): Promise<{ preCompraOrder: PreCompraOrder; albumPackOrder: Order }> {
  const {
    albumId,
    buyerEmail,
    buyerUserId,
    buyerName,
    buyerPhone,
    isSchool,
    resolvedSchoolCourseId,
    resolvedStudentFirstName,
    resolvedStudentLastName,
    resolvedStudentId,
    resolvedAlbumRosterEntryId,
    resolvedStudentSourceType,
    resolvedLevelSnap,
    resolvedShiftSnap,
    resolvedCourseSnap,
    resolvedDivisionSnap,
    orderItems,
    packDefinitionId,
    packQuantity,
    totalCents,
    orderTotalArs,
    pricingSnapshot,
    platformPercent,
    now,
    isTest,
    checkoutPaymentSource,
    preventaReqs,
    organizerReferralSchoolId,
  } = ctx;

  const preCompraOrder = await tx.preCompraOrder.create({
    data: {
      albumId,
      buyerEmail,
      buyerUserId: Number.isFinite(buyerUserId) ? buyerUserId : null,
      buyerName: buyerName || null,
      buyerPhone: buyerPhone || null,
      schoolCourseId: isSchool ? resolvedSchoolCourseId : null,
      studentFirstName: isSchool ? resolvedStudentFirstName : null,
      studentLastName: isSchool ? resolvedStudentLastName : null,
      studentId: isSchool ? resolvedStudentId : null,
      albumRosterEntryId: isSchool ? resolvedAlbumRosterEntryId : null,
      studentSourceType: isSchool ? resolvedStudentSourceType : null,
      studentLevelSnapshot: isSchool ? resolvedLevelSnap : null,
      studentShiftSnapshot: isSchool ? resolvedShiftSnap : null,
      studentCourseSnapshot: isSchool ? resolvedCourseSnap : null,
      studentDivisionSnapshot: isSchool ? resolvedDivisionSnap : null,
      status: "CREATED",
      totalCents,
      isTest,
    },
  });

  const itemRows: {
    orderId: number;
    packDefinitionId: number;
    albumProductId: null;
    status: "WAITING_SELFIE";
    priceCents: number;
  }[] = [];
  for (const it of orderItems) {
    for (let i = 0; i < it.quantity; i++) {
      itemRows.push({
        orderId: preCompraOrder.id,
        packDefinitionId: it.packDefinitionId,
        albumProductId: null,
        status: "WAITING_SELFIE",
        priceCents: it.priceCents,
      });
    }
  }
  await tx.preCompraOrderItem.createMany({ data: itemRows });

  if (preventaReqs.requiresSchoolData && resolvedStudentFirstName && resolvedStudentLastName) {
    const label = `${resolvedStudentFirstName} ${resolvedStudentLastName}`.trim();
    const subject = await tx.subject.create({
      data: {
        albumId,
        label,
        firstName: resolvedStudentFirstName,
        lastName: resolvedStudentLastName,
        schoolCourseId: resolvedSchoolCourseId,
        createdByOrderId: preCompraOrder.id,
      },
    });
    const firstItem = await tx.preCompraOrderItem.findFirst({
      where: { orderId: preCompraOrder.id },
      select: { id: true },
    });
    if (firstItem) {
      await tx.preCompraOrderItem.update({
        where: { id: firstItem.id },
        data: { subjectId: subject.id },
      });
    }
  }

  const packRow = await tx.packDefinition.findFirst({
    where: { id: packDefinitionId, albumId },
    include: {
      benefits: {
        orderBy: { sortOrder: "asc" },
        include: {
          template: { select: { name: true } },
          photographerProduct: { select: { name: true } },
        },
      },
    },
  });
  if (!packRow) {
    throw new Error("pack_not_found_for_snapshot");
  }

  const snapshotBase = buildPreventaPackSnapshotV1(packRow, now);
  const clientUnitArs = clientTotalArsFromPhotographerBaseArs(packRow.priceClientArs, platformPercent);
  const snapshotWithClientPrice = { ...snapshotBase, priceClientArs: clientUnitArs };
  const preventaPackSnapshotJson = scalePreventaPackSnapshotV1ByPackQuantity(
    snapshotWithClientPrice,
    packQuantity
  ) as unknown as Prisma.InputJsonValue;

  const albumPackOrder = await tx.order.create({
    data: {
      albumId,
      buyerEmail,
      buyerUserId: Number.isFinite(buyerUserId) ? buyerUserId : null,
      buyerName: buyerName || null,
      buyerPhone: buyerPhone || null,
      totalCents: orderTotalArs,
      status: "PENDING",
      origin: OrderOrigin.PREVENTA_PACK,
      checkoutPaymentSource,
      preCompraPaymentRef: String(preCompraOrder.id),
      pricingSnapshot,
      preventaPackSnapshotJson,
      isTest,
      organizerSchoolId: organizerReferralSchoolId,
      organizerReferralApplied: organizerReferralSchoolId != null,
    },
  });

  return { preCompraOrder, albumPackOrder };
}
