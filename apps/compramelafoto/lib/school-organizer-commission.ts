import {
  OrganizerCommissionAppliesTo,
  OrderOrigin,
  OrganizerCommissionStatus,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

function getCommissionKindFromOrderOrigin(origin: OrderOrigin): OrganizerCommissionAppliesTo | null {
  if (origin === OrderOrigin.PREVENTA_PACK) return OrganizerCommissionAppliesTo.PREVENTA;
  if (origin === OrderOrigin.STANDARD_CHECKOUT) return OrganizerCommissionAppliesTo.POST_EVENT;
  if (origin === OrderOrigin.PACK_REDEMPTION) return OrganizerCommissionAppliesTo.EXTRAS;
  return null;
}

function readPreventaOrderIdFromPricingSnapshot(pricingSnapshot: unknown): number | null {
  if (!pricingSnapshot || typeof pricingSnapshot !== "object") return null;
  const raw = (pricingSnapshot as Record<string, unknown>).preventaOrderId;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function loadPreventaPackSchoolId(preventaOrderId: number): Promise<number | null> {
  const parent = await prisma.order.findUnique({
    where: { id: preventaOrderId },
    select: {
      origin: true,
      organizerSchoolId: true,
      organizerReferralApplied: true,
      album: { select: { schoolId: true } },
    },
  });
  if (!parent || parent.origin !== OrderOrigin.PREVENTA_PACK) return null;
  if (
    parent.organizerReferralApplied &&
    parent.organizerSchoolId != null &&
    parent.album?.schoolId != null &&
    parent.organizerSchoolId === parent.album.schoolId
  ) {
    return parent.organizerSchoolId;
  }
  return parent.album?.schoolId ?? null;
}

/**
 * Resuelve la escuela atribuible según el tipo de comisión.
 * - PREVENTA: solo con referral explícito (?ref=school_{id}) persistido en el Order.
 * - POST_EVENT: álbum escolar (Album.schoolId).
 * - EXTRAS: álbum escolar o preventa padre atribuida (canje / snapshot).
 */
export async function resolveSchoolIdForOrganizerCommission(input: {
  origin: OrderOrigin;
  organizerReferralApplied: boolean;
  organizerSchoolId: number | null;
  redeemsOrderId: number | null;
  pricingSnapshot: unknown;
  albumSchoolId: number | null;
  kind: OrganizerCommissionAppliesTo;
}): Promise<number | null> {
  const { kind, albumSchoolId } = input;

  if (kind === OrganizerCommissionAppliesTo.PREVENTA) {
    if (
      input.organizerReferralApplied &&
      input.organizerSchoolId != null &&
      albumSchoolId != null &&
      input.organizerSchoolId === albumSchoolId
    ) {
      return input.organizerSchoolId;
    }
    return null;
  }

  if (kind === OrganizerCommissionAppliesTo.POST_EVENT) {
    return albumSchoolId;
  }

  if (kind === OrganizerCommissionAppliesTo.EXTRAS) {
    if (albumSchoolId != null) {
      return albumSchoolId;
    }
    if (input.redeemsOrderId != null) {
      const fromRedeem = await loadPreventaPackSchoolId(input.redeemsOrderId);
      if (fromRedeem != null) return fromRedeem;
    }
    const preventaOrderId = readPreventaOrderIdFromPricingSnapshot(input.pricingSnapshot);
    if (preventaOrderId != null) {
      return loadPreventaPackSchoolId(preventaOrderId);
    }
    return null;
  }

  return null;
}

export async function createOrganizerCommissionForPaidOrder(input: {
  orderId: number;
  paymentId: string;
}): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      albumId: true,
      origin: true,
      totalCents: true,
      platformCommissionCents: true,
      organizerReferralApplied: true,
      organizerSchoolId: true,
      redeemsOrderId: true,
      pricingSnapshot: true,
    },
  });
  if (!order) return;

  const album = await prisma.album.findUnique({
    where: { id: order.albumId },
    select: {
      id: true,
      schoolId: true,
      organizerCommissionEnabled: true,
      organizerCommissionPercentage: true,
      organizerCommissionAppliesTo: true,
    },
  });
  if (!album) return;
  if (!album.organizerCommissionEnabled) return;
  if (album.schoolId == null) return;

  const kind = getCommissionKindFromOrderOrigin(order.origin);
  if (!kind) return;
  const appliesTo = album.organizerCommissionAppliesTo ?? [];
  if (!appliesTo.includes(kind)) return;

  const schoolId = await resolveSchoolIdForOrganizerCommission({
    origin: order.origin,
    organizerReferralApplied: order.organizerReferralApplied,
    organizerSchoolId: order.organizerSchoolId,
    redeemsOrderId: order.redeemsOrderId,
    pricingSnapshot: order.pricingSnapshot,
    albumSchoolId: album.schoolId,
    kind,
  });
  if (schoolId == null || schoolId !== album.schoolId) return;

  const percentage = Number(album.organizerCommissionPercentage ?? 0);
  if (!Number.isFinite(percentage) || percentage <= 0) return;

  const baseAmount = Math.max(
    0,
    Number(order.totalCents ?? 0) - Number(order.platformCommissionCents ?? 0)
  );
  const amount = Math.max(0, Math.round((baseAmount * percentage) / 100));
  if (amount <= 0) return;

  const existing = await prisma.organizerCommission.findUnique({
    where: { orderId: order.id },
    select: { id: true },
  });
  if (existing) return;

  const organizerMembership = await prisma.schoolOrganizer.findFirst({
    where: { schoolId: album.schoolId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });

  try {
    await prisma.organizerCommission.create({
      data: {
        schoolId: album.schoolId,
        albumId: album.id,
        orderId: order.id,
        organizerUserId: organizerMembership?.userId ?? null,
        amount,
        percentage,
        baseAmount,
        status: OrganizerCommissionStatus.PENDING,
      },
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") return;
    throw err;
  }
}

export async function cancelOrganizerCommissionForOrder(orderId: number): Promise<void> {
  await prisma.organizerCommission.updateMany({
    where: {
      orderId,
      status: {
        not: OrganizerCommissionStatus.CANCELLED,
      },
    },
    data: {
      status: OrganizerCommissionStatus.CANCELLED,
    },
  });
}
