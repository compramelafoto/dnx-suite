import type { PaymentInfo } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import { registerAuditEvent } from "@/lib/antifraud/audit";

export type SyncPreCompraFromMpOptions = {
  /** Si true, registra eventos MP_RECONCILIATION_* cuando hay trabajo útil */
  triggeredByReconciliation?: boolean;
};

/**
 * Sincroniza PreCompraOrder + PackPurchaseEntitlement con el estado real del pago en Mercado Pago.
 * - approved → PAID_HELD
 * - pending / in_process → sin cambio (no pisar un pago ya acreditado)
 * - resto → CANCELED + VOID del entitlement si aún no fue canjeado (REDEEMED se conserva con trazabilidad)
 */
export async function syncPreCompraOrderFromMercadoPagoPayment(
  preCompraOrderId: number,
  pay: PaymentInfo,
  opts?: SyncPreCompraFromMpOptions
): Promise<{ changed: boolean }> {
  const st = pay.status;

  if (st === "approved") {
    const row = await prisma.preCompraOrder.findUnique({
      where: { id: preCompraOrderId },
      select: { status: true, albumId: true },
    });
    if (!row) return { changed: false };
    if (row.status === "PAID_HELD") return { changed: false };

    await prisma.preCompraOrder.update({
      where: { id: preCompraOrderId },
      data: { status: "PAID_HELD" },
    });

    if (opts?.triggeredByReconciliation) {
      await registerAuditEvent({
        targetOrderType: "PRECOMPRA_ORDER",
        targetOrderId: preCompraOrderId,
        targetAlbumId: row.albumId,
        eventType: "MP_RECONCILIATION_PRECOMPRA_INSPECTED",
        metadata: {
          mpPaymentId: pay.id,
          mpStatus: st,
          action: "set_paid_held",
          previousStatus: row.status,
        },
      });
    }

    return { changed: true };
  }

  if (st === "pending" || st === "in_process") {
    return { changed: false };
  }

  const row = await prisma.preCompraOrder.findUnique({
    where: { id: preCompraOrderId },
    select: { id: true, status: true, albumId: true },
  });
  if (!row) return { changed: false };

  const alreadyCanceled = row.status === "CANCELED";

  await prisma.preCompraOrder.update({
    where: { id: preCompraOrderId },
    data: { status: "CANCELED" },
  });

  const ent = await prisma.packPurchaseEntitlement.findUnique({
    where: { preCompraOrderId },
    select: { id: true, status: true, redeemedOrderId: true },
  });

  let entitlementAction: "none" | "voided" | "kept_redeemed" = "none";
  if (ent) {
    if (ent.status === "REDEEMED" || ent.redeemedOrderId != null) {
      entitlementAction = "kept_redeemed";
    } else if (ent.status !== "VOID") {
      await prisma.packPurchaseEntitlement.update({
        where: { id: ent.id },
        data: { status: "VOID" },
      });
      entitlementAction = "voided";
    }
  }

  const eventType =
    st === "refunded"
      ? "PAYMENT_REFUNDED"
      : st === "charged_back"
        ? "PAYMENT_CHARGED_BACK"
        : "PAYMENT_REJECTED";

  await registerAuditEvent({
    targetOrderType: "PRECOMPRA_ORDER",
    targetOrderId: preCompraOrderId,
    targetAlbumId: row.albumId,
    eventType,
    metadata: {
      mpPaymentId: pay.id,
      mpStatus: st,
      statusDetail: pay.status_detail,
      preCompraPreviousStatus: row.status,
      entitlementAction,
      entitlementId: ent?.id ?? null,
      ...(opts?.triggeredByReconciliation ? { triggeredByReconciliation: true } : {}),
    },
  });

  if (
    entitlementAction === "kept_redeemed" &&
    (st === "refunded" || st === "charged_back")
  ) {
    await registerAuditEvent({
      targetOrderType: "PRECOMPRA_ORDER",
      targetOrderId: preCompraOrderId,
      targetAlbumId: row.albumId,
      eventType: "PAYMENT_REVERSED_AFTER_REDEEM",
      metadata: {
        mpPaymentId: pay.id,
        mpStatus: st,
        entitlementId: ent?.id ?? null,
        redeemedOrderId: ent?.redeemedOrderId ?? null,
        message:
          "Pago revertido en MP después del canje; entitlement y pedido de canje se conservan para trazabilidad",
      },
    });
  }

  const preCompraChanged = !alreadyCanceled;
  const entitlementChanged = entitlementAction === "voided";
  const postRedeemRisk =
    entitlementAction === "kept_redeemed" &&
    (st === "refunded" || st === "charged_back");

  if (
    opts?.triggeredByReconciliation &&
    (preCompraChanged || entitlementChanged || postRedeemRisk)
  ) {
    await registerAuditEvent({
      targetOrderType: "PRECOMPRA_ORDER",
      targetOrderId: preCompraOrderId,
      targetAlbumId: row.albumId,
      eventType: "MP_RECONCILIATION_PRECOMPRA_INSPECTED",
      metadata: {
        mpPaymentId: pay.id,
        mpStatus: st,
        preCompraChanged,
        entitlementAction,
        postRedeemRisk,
      },
    });
  }

  console.info("[MP] syncPreCompraOrderFromMercadoPagoPayment", {
    preCompraOrderId,
    mpPaymentId: pay.id,
    mpStatus: st,
    entitlementAction,
  });

  return { changed: preCompraChanged || entitlementChanged };
}
