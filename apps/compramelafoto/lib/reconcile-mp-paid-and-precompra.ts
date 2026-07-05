import {
  CheckoutPaymentSource,
  OrderStatus,
  PackPurchaseEntitlementStatus,
  PreCompraOrderStatus,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getPaymentById, searchPaymentsByExternalReference, type PaymentStatus } from "@/lib/mercadopago";
import {
  reverseAlbumOrderMercadoPagoIfWasPaid,
  type AlbumOrderMpReversalAuditReason,
} from "@/lib/mercadopago/reverse-album-order-mercado-pago";
import { syncPreCompraOrderFromMercadoPagoPayment } from "@/lib/mercadopago/reverse-precompra-order-mercado-pago";
import { registerAuditEvent } from "@/lib/antifraud/audit";

function mpStatusToReversalReason(st: PaymentStatus): AlbumOrderMpReversalAuditReason {
  if (st === "refunded") return "REFUNDED";
  if (st === "charged_back") return "CHARGED_BACK";
  if (st === "cancelled") return "CANCELLED";
  return "REJECTED";
}

export type ReconcileMpPaidAndPreCompraResult = {
  albumPaid: {
    scanned: number;
    reversed: number;
    skippedPendingLike: number;
    skippedNoMp: number;
    /** dryRun: pedidos PAID que en MP ya no están aprobados ni pendientes */
    wouldReverse: Array<{ orderId: number; mpStatus: string; mpPaymentId: string }>;
    errors: Array<{ orderId: number; message: string }>;
  };
  preCompra: {
    scanned: number;
    syncedChanges: number;
    /** dryRun: filas donde sync aplicaría cambio según el pago más reciente en MP */
    wouldSync: Array<{ preCompraOrderId: number; mpStatus: string; mpPaymentId: string }>;
    noMpPayment: number;
    errors: Array<{ preCompraOrderId: number; message: string }>;
  };
  entitlements: {
    scanned: number;
    voided: number;
    skippedDryRun: number;
  };
};

/**
 * Reconciliación de negocio: órdenes de álbum PAID, preventa escolar PAID_HELD y entitlements
 * desalineados. Reutiliza reversión/sync de webhook con idempotencia en las funciones base.
 *
 * Órdenes PAID: ventana temporal por `Order.updatedAt` (cualquier `prisma.order.update` la mueve;
 * pagos MP / entrega digital / reversión incluidos). Más fiable que `createdAt` ∪ `digitalDeliveredAt`.
 */
export async function reconcileMercadoPagoPaidAndPreCompra(opts: {
  daysBack?: number;
  maxAlbumOrders?: number;
  maxPreCompraOrders?: number;
  maxEntitlements?: number;
  dryRun?: boolean;
}): Promise<ReconcileMpPaidAndPreCompraResult> {
  const daysBack = Math.min(Math.max(opts.daysBack ?? 30, 1), 365);
  const maxAlbum = Math.min(Math.max(opts.maxAlbumOrders ?? 400, 1), 2000);
  const maxPco = Math.min(Math.max(opts.maxPreCompraOrders ?? 400, 1), 2000);
  const maxEnt = Math.min(Math.max(opts.maxEntitlements ?? 500, 1), 3000);
  const dryRun = opts.dryRun === true;

  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const searchRangeDays = Math.min(daysBack + 14, 400);

  const albumPaid = {
    scanned: 0,
    reversed: 0,
    skippedPendingLike: 0,
    skippedNoMp: 0,
    wouldReverse: [] as Array<{ orderId: number; mpStatus: string; mpPaymentId: string }>,
    errors: [] as Array<{ orderId: number; message: string }>,
  };

  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PAID,
      updatedAt: { gte: since },
    },
    include: { album: { select: { userId: true } } },
    orderBy: { id: "asc" },
    take: maxAlbum,
  });

  for (const order of orders) {
    albumPaid.scanned += 1;

    if (order.checkoutPaymentSource === CheckoutPaymentSource.PREPAID_PACK) {
      albumPaid.skippedNoMp += 1;
      continue;
    }
    if (!order.mpPaymentId || order.mpPaymentId.trim() === "") {
      albumPaid.skippedNoMp += 1;
      continue;
    }

    let accessTokenOverride: string | undefined;
    if (order.album?.userId) {
      const photographer = await prisma.user.findUnique({
        where: { id: order.album.userId },
        select: { mpAccessToken: true },
      });
      accessTokenOverride = photographer?.mpAccessToken ?? undefined;
    }

    try {
      let pay;
      try {
        pay = await getPaymentById(String(order.mpPaymentId), { accessTokenOverride });
      } catch {
        pay = await getPaymentById(String(order.mpPaymentId), {});
      }

      if (pay.status === "approved") continue;
      if (pay.status === "pending" || pay.status === "in_process") {
        albumPaid.skippedPendingLike += 1;
        continue;
      }

      if (dryRun) {
        albumPaid.wouldReverse.push({
          orderId: order.id,
          mpStatus: pay.status,
          mpPaymentId: pay.id,
        });
        continue;
      }

      const rev = await reverseAlbumOrderMercadoPagoIfWasPaid({
        orderId: order.id,
        mpPaymentId: pay.id,
        mpStatus: pay.status,
        statusDetail: pay.status_detail,
        auditReason: mpStatusToReversalReason(pay.status),
      });

      if (rev.applied) {
        albumPaid.reversed += 1;
        await registerAuditEvent({
          targetOrderType: "ALBUM_ORDER",
          targetOrderId: order.id,
          targetAlbumId: order.albumId,
          eventType: "MP_RECONCILIATION_ALBUM_PAID_CORRECTED",
          metadata: {
            mpPaymentId: pay.id,
            mpStatus: pay.status,
            previousLocalStatus: "PAID",
            message: "Reconciliación: PAID local alineado con MP (reversión aplicada)",
          },
        });
      }
    } catch (e) {
      albumPaid.errors.push({
        orderId: order.id,
        message: String((e as Error)?.message ?? e),
      });
    }
  }

  const preCompra = {
    scanned: 0,
    syncedChanges: 0,
    wouldSync: [] as Array<{ preCompraOrderId: number; mpStatus: string; mpPaymentId: string }>,
    noMpPayment: 0,
    errors: [] as Array<{ preCompraOrderId: number; message: string }>,
  };

  const pcos = await prisma.preCompraOrder.findMany({
    where: {
      status: PreCompraOrderStatus.PAID_HELD,
      OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }],
    },
    include: { album: { select: { userId: true } } },
    orderBy: { id: "asc" },
    take: maxPco,
  });

  for (const pco of pcos) {
    preCompra.scanned += 1;

    let accessTokenOverride: string | undefined;
    if (pco.album?.userId) {
      const photographer = await prisma.user.findUnique({
        where: { id: pco.album.userId },
        select: { mpAccessToken: true },
      });
      accessTokenOverride = photographer?.mpAccessToken ?? undefined;
    }

    try {
      let payments;
      try {
        payments = await searchPaymentsByExternalReference(String(pco.id), {
          accessTokenOverride,
          dateRangeDays: searchRangeDays,
        });
      } catch {
        try {
          payments = await searchPaymentsByExternalReference(String(pco.id), {
            dateRangeDays: searchRangeDays,
          });
        } catch (e2) {
          preCompra.errors.push({
            preCompraOrderId: pco.id,
            message: `search_failed: ${String((e2 as Error)?.message ?? e2)}`,
          });
          continue;
        }
      }

      if (payments.length === 0) {
        preCompra.noMpPayment += 1;
        if (!dryRun) {
          await registerAuditEvent({
            targetOrderType: "PRECOMPRA_ORDER",
            targetOrderId: pco.id,
            targetAlbumId: pco.albumId,
            eventType: "MP_RECONCILIATION_PRECOMPRA_NO_MP_PAYMENT",
            metadata: {
              message:
                "Reconciliación: PAID_HELD sin pagos MP en la ventana buscada (revisar external_reference o rango)",
              daysBack: searchRangeDays,
            },
          });
        }
        continue;
      }

      const pay = payments[0];

      if (dryRun) {
        if (
          pay.status !== "approved" &&
          pay.status !== "pending" &&
          pay.status !== "in_process"
        ) {
          preCompra.wouldSync.push({
            preCompraOrderId: pco.id,
            mpStatus: pay.status,
            mpPaymentId: pay.id,
          });
        }
        continue;
      }

      const { changed } = await syncPreCompraOrderFromMercadoPagoPayment(pco.id, pay, {
        triggeredByReconciliation: true,
      });
      if (changed) preCompra.syncedChanges += 1;
    } catch (e) {
      preCompra.errors.push({
        preCompraOrderId: pco.id,
        message: String((e as Error)?.message ?? e),
      });
    }
  }

  const entitlements = {
    scanned: 0,
    voided: 0,
    skippedDryRun: 0,
  };

  const entRows = await prisma.packPurchaseEntitlement.findMany({
    where: {
      redeemedOrderId: null,
      status: {
        in: [
          PackPurchaseEntitlementStatus.UNPAID,
          PackPurchaseEntitlementStatus.PAID_ACTIVE,
          PackPurchaseEntitlementStatus.IN_REDEMPTION,
          PackPurchaseEntitlementStatus.AWAITING_EXTRAS_PAYMENT,
        ],
      },
      preCompraOrder: { status: PreCompraOrderStatus.CANCELED },
    },
    select: { id: true, preCompraOrderId: true, albumId: true },
    take: maxEnt,
  });

  for (const row of entRows) {
    entitlements.scanned += 1;
    if (dryRun) {
      entitlements.skippedDryRun += 1;
      continue;
    }
    await prisma.packPurchaseEntitlement.update({
      where: { id: row.id },
      data: { status: PackPurchaseEntitlementStatus.VOID },
    });
    entitlements.voided += 1;
    await registerAuditEvent({
      targetOrderType: "PRECOMPRA_ORDER",
      targetOrderId: row.preCompraOrderId,
      targetAlbumId: row.albumId,
      eventType: "MP_RECONCILIATION_ENTITLEMENT_VOIDED",
      metadata: {
        entitlementId: row.id,
        message:
          "Reconciliación: entitlement activo alineado con PreCompraOrder cancelada",
      },
    });
  }

  return { albumPaid, preCompra, entitlements };
}
