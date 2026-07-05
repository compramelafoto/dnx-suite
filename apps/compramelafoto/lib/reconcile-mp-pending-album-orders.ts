import { CheckoutPaymentSource, OrderStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { searchPaymentsByExternalReference } from "@/lib/mercadopago";
import { finalizeAlbumOrderMercadoPagoApproved } from "@/lib/mercadopago/finalize-album-order-mp-approved";

export type ReconcilePendingAlbumOrdersResult = {
  scanned: number;
  scannedPending: number;
  scannedFailed: number;
  applied: number;
  recoveredFromFailed: number;
  skippedNoPayment: number;
  skippedDryRun: number;
  /** Solo en dryRun: pedidos que tendrían cierre con el pago indicado */
  wouldApply: Array<{ orderId: number; paymentId: string; previousStatus: string }>;
  errors: Array<{ orderId: number; message: string }>;
  appliedDetails: Array<{ orderId: number; paymentId: string; previousStatus: string }>;
};

async function reconcileOneAlbumOrder(
  order: { id: number; status: OrderStatus; album: { userId: number } | null },
  opts: {
    dryRun?: boolean;
    searchRangeDays: number;
  },
  out: ReconcilePendingAlbumOrdersResult
): Promise<void> {
  const wasFailed = order.status === OrderStatus.FAILED;

  let accessTokenOverride: string | undefined;
  if (order.album?.userId) {
    const photographer = await prisma.user.findUnique({
      where: { id: order.album.userId },
      select: { mpAccessToken: true },
    });
    accessTokenOverride = photographer?.mpAccessToken ?? undefined;
  }

  let payments: Awaited<ReturnType<typeof searchPaymentsByExternalReference>> = [];
  try {
    payments = await searchPaymentsByExternalReference(String(order.id), {
      accessTokenOverride,
      dateRangeDays: opts.searchRangeDays,
    });
  } catch (e: unknown) {
    if (!accessTokenOverride) {
      out.errors.push({
        orderId: order.id,
        message: `search_failed: ${String((e as Error)?.message ?? e)}`,
      });
      return;
    }
    try {
      payments = await searchPaymentsByExternalReference(String(order.id), {
        dateRangeDays: opts.searchRangeDays,
      });
    } catch (e2: unknown) {
      out.errors.push({
        orderId: order.id,
        message: `search_failed_fallback: ${String((e2 as Error)?.message ?? e2)}`,
      });
      return;
    }
  }

  const approved = payments
    .filter((p) => p.status === "approved")
    .sort((a, b) => {
      const ta = a.date_approved || a.date_created || "";
      const tb = b.date_approved || b.date_created || "";
      return tb.localeCompare(ta);
    });

  if (approved.length === 0) {
    out.skippedNoPayment += 1;
    return;
  }

  const best = approved[0];
  if (opts.dryRun) {
    out.skippedDryRun += 1;
    out.wouldApply.push({
      orderId: order.id,
      paymentId: best.id,
      previousStatus: order.status,
    });
    return;
  }

  const result = await finalizeAlbumOrderMercadoPagoApproved(order.id, best.id, {
    accessTokenOverride,
  });

  if (result.ok && "applied" in result && result.applied) {
    out.applied += 1;
    if (wasFailed) out.recoveredFromFailed += 1;
    out.appliedDetails.push({
      orderId: order.id,
      paymentId: best.id,
      previousStatus: order.status,
    });
  } else if (result.ok && "skipped" in result && result.skipped === "already_paid") {
    /* noop */
  } else if (!result.ok) {
    out.errors.push({
      orderId: order.id,
      message: result.error,
    });
  }
}

/**
 * Pedidos de álbum en PENDING o FAILED (reintento MP): busca pagos approved por external_reference
 * (= order id) y aplica el mismo cierre que el webhook (ZIP, emails, etc.).
 */
export async function reconcilePendingAlbumOrdersMercadoPago(opts: {
  daysBack?: number;
  dryRun?: boolean;
  maxOrders?: number;
}): Promise<ReconcilePendingAlbumOrdersResult> {
  const daysBack = Math.min(Math.max(opts.daysBack ?? 30, 1), 365);
  const maxOrders = Math.min(Math.max(opts.maxOrders ?? 500, 1), 2000);
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const baseWhere = {
    createdAt: { gte: since },
    isTest: false,
    checkoutPaymentSource: CheckoutPaymentSource.MERCADO_PAGO,
  } as const;

  const orders = await prisma.order.findMany({
    where: {
      ...baseWhere,
      status: { in: [OrderStatus.PENDING, OrderStatus.FAILED] },
    },
    include: { album: { select: { userId: true } } },
    orderBy: { id: "asc" },
    take: maxOrders,
  });

  const out: ReconcilePendingAlbumOrdersResult = {
    scanned: orders.length,
    scannedPending: orders.filter((o) => o.status === OrderStatus.PENDING).length,
    scannedFailed: orders.filter((o) => o.status === OrderStatus.FAILED).length,
    applied: 0,
    recoveredFromFailed: 0,
    skippedNoPayment: 0,
    skippedDryRun: 0,
    wouldApply: [],
    errors: [],
    appliedDetails: [],
  };

  const searchRangeDays = Math.min(daysBack + 14, 400);

  for (const order of orders) {
    await reconcileOneAlbumOrder(order, { dryRun: opts.dryRun, searchRangeDays }, out);
  }

  return out;
}

/**
 * Recupera un pedido concreto buscando el pago approved más reciente en MP (o usando paymentId).
 */
export async function recoverAlbumOrderFromMercadoPagoPayment(opts: {
  orderId: number;
  paymentId?: string;
}): Promise<
  | { ok: true; applied: true; paymentId: string; previousStatus: string }
  | { ok: true; skipped: "already_paid"; paymentId: string }
  | { ok: false; error: string }
> {
  const order = await prisma.order.findUnique({
    where: { id: opts.orderId },
    include: { album: { select: { userId: true } } },
  });
  if (!order) return { ok: false, error: "order_not_found" };
  if (order.isTest) return { ok: false, error: "test_order" };
  if (order.checkoutPaymentSource !== CheckoutPaymentSource.MERCADO_PAGO) {
    return { ok: false, error: "not_mercado_pago_checkout" };
  }

  let accessTokenOverride: string | undefined;
  if (order.album?.userId) {
    const photographer = await prisma.user.findUnique({
      where: { id: order.album.userId },
      select: { mpAccessToken: true },
    });
    accessTokenOverride = photographer?.mpAccessToken ?? undefined;
  }

  let paymentId = opts.paymentId?.trim();
  if (!paymentId) {
    let payments: Awaited<ReturnType<typeof searchPaymentsByExternalReference>> = [];
    try {
      payments = await searchPaymentsByExternalReference(String(order.id), {
        accessTokenOverride,
        dateRangeDays: 400,
      });
    } catch (e: unknown) {
      if (accessTokenOverride) {
        payments = await searchPaymentsByExternalReference(String(order.id), {
          dateRangeDays: 400,
        });
      } else {
        return { ok: false, error: `search_failed: ${String((e as Error)?.message ?? e)}` };
      }
    }
    const approved = payments
      .filter((p) => p.status === "approved")
      .sort((a, b) => {
        const ta = a.date_approved || a.date_created || "";
        const tb = b.date_approved || b.date_created || "";
        return tb.localeCompare(ta);
      });
    if (approved.length === 0) return { ok: false, error: "no_approved_payment_in_mp" };
    paymentId = approved[0].id;
  }

  const previousStatus = order.status;
  const result = await finalizeAlbumOrderMercadoPagoApproved(order.id, paymentId, {
    accessTokenOverride,
  });

  if (result.ok && "skipped" in result && result.skipped === "already_paid") {
    return { ok: true, skipped: "already_paid", paymentId };
  }
  if (result.ok && "applied" in result && result.applied) {
    return { ok: true, applied: true, paymentId, previousStatus };
  }
  return { ok: false, error: !result.ok ? result.error : "finalize_not_applied" };
}
