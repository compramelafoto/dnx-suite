import {
  EventOrganizerCommissionPayoutMode,
  EventOrganizerCommissionStatus,
  OrderOrigin,
  OrderStatus,
  Prisma,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { baseFromTotal, feeFromTotal } from "@/lib/pricing/fee-formula";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { scheduleCheckoutFeeShadowCompare } from "@/lib/pricing/checkout-fee-shadow";
import { getPaymentById } from "@/lib/mercadopago";

const LOG_PREFIX = "[event-organizer-commission]";

const AVAILABLE_AFTER_MS = 15 * 24 * 60 * 60 * 1000;

function pesosToDecimal(amountPesos: number): Prisma.Decimal {
  const n = Number.isFinite(amountPesos) ? amountPesos : 0;
  const rounded = Math.round(n * 100) / 100;
  return new Prisma.Decimal(rounded.toFixed(2));
}

function roundOrganizerShareFromBase(basePesos: number, organizerPercent: number): number {
  if (!Number.isFinite(basePesos) || basePesos <= 0) return 0;
  if (!Number.isFinite(organizerPercent) || organizerPercent <= 0) return 0;
  return Math.round((basePesos * organizerPercent) / 100);
}

async function resolveMercadoPagoAccessTokenForAlbumOwner(
  photographerUserId: number,
  accessTokenOverride?: string
): Promise<string | undefined> {
  if (accessTokenOverride) return accessTokenOverride;
  const u = await prisma.user.findUnique({
    where: { id: photographerUserId },
    select: { mpAccessToken: true },
  });
  return u?.mpAccessToken ?? undefined;
}

async function resolvePaymentConfirmedAt(params: {
  orderId: number;
  mpPaymentId: string | null;
  photographerUserId: number;
  paymentApprovedAt?: Date;
  accessTokenOverride?: string;
}): Promise<Date> {
  if (params.paymentApprovedAt && !Number.isNaN(params.paymentApprovedAt.getTime())) {
    return params.paymentApprovedAt;
  }
  const pid = params.mpPaymentId?.trim();
  if (!pid) {
    return new Date();
  }
  const token = await resolveMercadoPagoAccessTokenForAlbumOwner(
    params.photographerUserId,
    params.accessTokenOverride
  );
  try {
    const pay = await getPaymentById(pid, { accessTokenOverride: token });
    if (pay.date_approved) {
      const d = new Date(pay.date_approved);
      if (!Number.isNaN(d.getTime())) return d;
    }
  } catch {
    try {
      const pay = await getPaymentById(pid, {});
      if (pay.date_approved) {
        const d = new Date(pay.date_approved);
        if (!Number.isNaN(d.getTime())) return d;
      }
    } catch {
      // ignore
    }
  }
  console.warn(LOG_PREFIX, "payment_date_fallback", { orderId: params.orderId });
  return new Date();
}

/**
 * Crea un único snapshot de comisión de organizador de evento para un pedido PAID (idempotente por orderId).
 * Montos en pesos ARS; la comisión del organizador es % sobre el precio base del fotógrafo (sin usar el total pagado).
 */
export async function ensureEventOrganizerCommissionSnapshotForPaidOrder(
  orderId: number,
  options?: { paymentApprovedAt?: Date; accessTokenOverride?: string }
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      album: {
        select: {
          id: true,
          userId: true,
          eventId: true,
          isTest: true,
          selectedLabId: true,
        },
      },
      items: { select: { productType: true } },
    },
  });

  if (!order || order.status !== OrderStatus.PAID || !order.album) {
    return;
  }

  if (order.isTest || order.album.isTest) {
    return;
  }

  const existing = await prisma.eventOrganizerCommission.findUnique({
    where: { orderId },
    select: { id: true },
  });
  if (existing) {
    console.info(`${LOG_PREFIX} skipped_existing`, { orderId });
    return;
  }

  const eventId = order.album.eventId;
  if (eventId == null) {
    console.info(`${LOG_PREFIX} skipped_no_event`, { orderId, albumId: order.album.id });
    return;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      creatorId: true,
      organizerCommissionEnabled: true,
      organizerCommissionPercentage: true,
    },
  });

  if (!event) {
    console.info(`${LOG_PREFIX} skipped_no_event`, { orderId, eventId });
    return;
  }

  if (
    !event.organizerCommissionEnabled ||
    event.organizerCommissionPercentage == null ||
    !Number.isFinite(event.organizerCommissionPercentage) ||
    event.organizerCommissionPercentage <= 0
  ) {
    console.info(`${LOG_PREFIX} skipped_disabled`, { orderId, eventId });
    return;
  }

  const hasPrintItems = order.items.some((it) => it.productType === "PRINT");
  const platformPercent =
    order.origin === OrderOrigin.PREVENTA_PACK || !hasPrintItems
      ? await resolveClientMarketplaceFeePercent({
          photographerId: order.album.userId,
          labId: order.album.selectedLabId ?? null,
        })
      : await resolvePlatformCommissionPercent({
          photographerId: order.album.userId,
          labId: order.album.selectedLabId ?? null,
        });

  scheduleCheckoutFeeShadowCompare({
    site: "event-organizer-snapshot.platform-percent",
    legacyFeePercent: platformPercent,
    resolveInput: {
      component: hasPrintItems ? "PRINT" : "DIGITAL",
      flow:
        order.origin === OrderOrigin.PREVENTA_PACK
          ? "PREVENTA_PACK"
          : order.origin === OrderOrigin.PACK_REDEMPTION
            ? "PACK_REDEMPTION"
            : "ALBUM_ORDER",
      purpose: "ORGANIZER_BASE_EXTRACT",
      photographerId: order.album.userId,
      labId: order.album.selectedLabId ?? null,
      albumId: order.albumId,
      hasPrintItems,
      orderOrigin:
        order.origin === OrderOrigin.PREVENTA_PACK
          ? "PREVENTA_PACK"
          : order.origin === OrderOrigin.PACK_REDEMPTION
            ? "PACK_REDEMPTION"
            : "STANDARD_CHECKOUT",
    },
    orderId: order.id,
    albumId: order.albumId,
    photographerId: order.album.userId,
    labId: order.album.selectedLabId ?? null,
    hasPrintItems,
    hasOrganizer: true,
    totalArsForEstimate: order.totalCents,
  });

  const extensionSurcharge = Number(order.extensionSurchargeCents ?? 0);
  const baseTotalPesos = Math.max(0, order.totalCents - extensionSurcharge);

  const photographerBasePesos = baseFromTotal(baseTotalPesos, platformPercent);
  const organizerCommissionPesos = roundOrganizerShareFromBase(
    photographerBasePesos,
    event.organizerCommissionPercentage
  );
  const photographerNetPesos = Math.max(0, photographerBasePesos - organizerCommissionPesos);

  const storedPlatformFee = order.platformCommissionCents;
  const platformFeePesos =
    storedPlatformFee != null && Number.isFinite(storedPlatformFee)
      ? Number(storedPlatformFee)
      : feeFromTotal(baseTotalPesos, platformPercent) + extensionSurcharge;

  const paymentConfirmedAt = await resolvePaymentConfirmedAt({
    orderId,
    mpPaymentId: order.mpPaymentId,
    photographerUserId: order.album.userId,
    paymentApprovedAt: options?.paymentApprovedAt,
    accessTokenOverride: options?.accessTokenOverride,
  });

  const availableAt = new Date(paymentConfirmedAt.getTime() + AVAILABLE_AFTER_MS);

  try {
    await prisma.eventOrganizerCommission.create({
      data: {
        orderId,
        eventId: event.id,
        organizerUserId: event.creatorId,
        photographerUserId: order.album.userId,
        albumId: order.album.id,
        organizerCommissionPercentage: event.organizerCommissionPercentage,
        photographerBaseAmount: pesosToDecimal(photographerBasePesos),
        platformFeeAmount: pesosToDecimal(platformFeePesos),
        organizerCommissionAmount: pesosToDecimal(organizerCommissionPesos),
        photographerNetAmount: pesosToDecimal(photographerNetPesos),
        totalPaidAmount: pesosToDecimal(order.totalCents),
        status: EventOrganizerCommissionStatus.PENDING,
        availableAt,
        paidAt: null,
        payoutMode: EventOrganizerCommissionPayoutMode.HELD_BY_PLATFORM,
      },
    });
    console.info(`${LOG_PREFIX} created`, {
      orderId,
      eventId: event.id,
      organizerUserId: event.creatorId,
      photographerBasePesos,
      organizerCommissionPesos,
      photographerNetPesos,
      platformFeePesos,
      totalPaidPesos: order.totalCents,
      availableAt: availableAt.toISOString(),
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      console.info(`${LOG_PREFIX} skipped_existing`, { orderId });
      return;
    }
    throw err;
  }
}

/**
 * Marca como cancelado el snapshot de comisión de evento si el pago del pedido se revierte.
 */
export async function cancelEventOrganizerCommissionForOrder(orderId: number): Promise<void> {
  const result = await prisma.eventOrganizerCommission.updateMany({
    where: {
      orderId,
      status: {
        in: [
          EventOrganizerCommissionStatus.PENDING,
          EventOrganizerCommissionStatus.AVAILABLE,
          EventOrganizerCommissionStatus.WITHDRAWAL_REQUESTED,
        ],
      },
    },
    data: { status: EventOrganizerCommissionStatus.CANCELLED, withdrawalRequestId: null },
  });
  if (result.count > 0) {
    console.info(`${LOG_PREFIX} cancelled`, { orderId, count: result.count });
  }
}
