import "server-only";

import { Prisma, prisma } from "@repo/db";
import { getDnxPaymentsClient } from "@/lib/checkout/actions/runtime";
import type { CreatePaymentOrderInput } from "@/lib/checkout/domain/types";
import { assertSafeCheckoutUrl } from "@/lib/checkout/domain/checkout-url";
import { StoreCheckoutError } from "./errors";
import {
  isStorePaymentsLiveEnabled,
} from "./feature-flags";
import { logStoreCheckoutEvent } from "./observability";

function publicBaseUrl(): string {
  return (
    process.env.CLICKATON_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3005"
  ).replace(/\/$/, "");
}

/**
 * Crea preferencia DNX Payments para pedido TIENDA.
 * sourceType STORE_ORDER; external_reference CLICKATON_STORE_ORDER:{publicId}.
 * Monto = order.totalAmount (servidor).
 */
export async function createStorePaymentPreference(input: {
  orderId: string;
  publicId: string;
  reusedAccessToken: string | null;
}): Promise<{ checkoutUrl: string; paymentOrderId: string; reused: boolean }> {
  const order = await prisma.clickatonStoreOrder.findUnique({
    where: { id: input.orderId },
  });
  if (!order) {
    throw new StoreCheckoutError("ORDER_NOT_FOUND", "Pedido no encontrado.", 404);
  }
  if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_FAILED") {
    throw new StoreCheckoutError("ORDER_NOT_PAYABLE", "El pedido no admite pago.");
  }
  if (order.holdExpiresAt && order.holdExpiresAt.getTime() < Date.now()) {
    throw new StoreCheckoutError("HOLD_EXPIRED", "La reserva venció.");
  }
  if (order.currency !== "ARS" || order.totalAmount <= 0) {
    throw new StoreCheckoutError("AMOUNT_MISMATCH", "Total inválido.");
  }

  const providerMode = (
    process.env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual"
  ).toLowerCase();
  if (providerMode.includes("production") || providerMode.includes("live")) {
    if (!isStorePaymentsLiveEnabled()) {
      throw new StoreCheckoutError(
        "PAYMENT_UNAVAILABLE",
        "Pagos live de tienda deshabilitados.",
        403,
      );
    }
  }

  const requiresEditionFinance =
    providerMode.includes("mercado_pago") || providerMode.includes("mp_");

  let editionFinance: CreatePaymentOrderInput["editionFinance"];
  if (order.editionId) {
    try {
      const { resolveActiveEditionDistribution } = await import(
        "@/lib/admin/edition-finance/infrastructure/prisma-edition-finance"
      );
      const { buildOrderFinanceSnapshot, toEditionCheckoutFinanceSnapshot } = await import(
        "@/lib/admin/edition-finance/domain/snapshot"
      );
      const { resolveCollectorAccessTokenFromPaymentAccount } = await import(
        "@/lib/admin/edition-finance/infrastructure/resolve-collector-token"
      );

      let snapJson = order.financialDistributionSnapshot;
      if (!snapJson) {
        const distribution = await resolveActiveEditionDistribution(order.editionId);
        if (!distribution) {
          if (requiresEditionFinance) {
            throw new StoreCheckoutError(
              "COLLECTOR_UNAVAILABLE",
              "Sin distribución financiera activa.",
            );
          }
        } else {
          const snap = buildOrderFinanceSnapshot({
            distribution,
            currency: order.currency,
            grossAmount: order.totalAmount,
            discountAmount: 0,
            providerFee: 0,
            platformFee: 0,
          });
          snapJson = snap as unknown as Prisma.JsonValue;
          await prisma.clickatonStoreOrder.update({
            where: { id: order.id },
            data: {
              financialDistributionSnapshot: snap as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }

      if (snapJson) {
        const checkoutSnap = toEditionCheckoutFinanceSnapshot(
          snapJson as unknown as Parameters<typeof toEditionCheckoutFinanceSnapshot>[0],
        );
        const collectorAccountId = checkoutSnap.allocations[0]?.paymentAccountId;
        let collectorAccessToken: string | undefined;
        if (requiresEditionFinance && collectorAccountId) {
          const tokenRes =
            await resolveCollectorAccessTokenFromPaymentAccount(collectorAccountId);
          if (!tokenRes.ok) {
            throw new StoreCheckoutError(
              "COLLECTOR_UNAVAILABLE",
              "Collector Mercado Pago no usable.",
            );
          }
          collectorAccessToken = tokenRes.accessToken;
        }
        editionFinance = {
          snapshot: checkoutSnap,
          ...(collectorAccessToken ? { collectorAccessToken } : {}),
        };
      }
    } catch (err) {
      if (err instanceof StoreCheckoutError) throw err;
      if (requiresEditionFinance) {
        throw new StoreCheckoutError(
          "COLLECTOR_UNAVAILABLE",
          err instanceof Error ? err.message.slice(0, 160) : "Collector no disponible.",
        );
      }
    }
  } else if (requiresEditionFinance) {
    throw new StoreCheckoutError(
      "COLLECTOR_UNAVAILABLE",
      "Pedido sin edición para resolver collector.",
    );
  }

  const base = publicBaseUrl();
  const tokenQ = encodeURIComponent(input.reusedAccessToken ?? "cookie");
  const attempt = order.paymentOrderId ? 2 : 1;
  const idempotencyKey =
    order.paymentIdempotencyKey ??
    `clickaton:store:${order.publicId}:pay:a${attempt}`;

  const payments = getDnxPaymentsClient();
  const orderInput: CreatePaymentOrderInput = {
    sourceApp: "CLICKATON",
    sourceType: "STORE_ORDER",
    sourceId: order.publicId,
    idempotencyKey,
    amountMinor: order.totalAmount,
    currency: "ARS",
    description: `Tienda Clickatón ${order.publicId}`,
    payer: {
      email: order.customerEmail,
      firstName: order.customerFirstName,
      lastName: order.customerLastName,
    },
    successUrl: `${base}/tienda/pago/exito?order=${encodeURIComponent(order.publicId)}&t=${tokenQ}`,
    pendingUrl: `${base}/tienda/pago/pendiente?order=${encodeURIComponent(order.publicId)}&t=${tokenQ}`,
    failureUrl: `${base}/tienda/pago/error?order=${encodeURIComponent(order.publicId)}&t=${tokenQ}`,
    webhookContext: {
      sourceApp: "CLICKATON",
      sourceType: "STORE_ORDER",
      publicId: order.publicId,
    },
    ...(editionFinance ? { editionFinance } : {}),
  };

  const result = await payments.createOrder(orderInput);
  if (result.outcome === "conflict") {
    throw new StoreCheckoutError("IDEMPOTENCY_CONFLICT", result.message, 409);
  }

  const payOrder = result.order;
  if (!payOrder.checkoutUrl) {
    throw new StoreCheckoutError("PAYMENT_UNAVAILABLE", "Sin URL de checkout.");
  }
  const urlCheck = assertSafeCheckoutUrl(payOrder.checkoutUrl);
  if (!urlCheck.ok) {
    throw new StoreCheckoutError("PAYMENT_UNAVAILABLE", urlCheck.message);
  }

  if (payOrder.amountMinor !== order.totalAmount) {
    throw new StoreCheckoutError(
      "AMOUNT_MISMATCH",
      "El monto de la preferencia no coincide con la orden.",
      500,
    );
  }
  if (payOrder.currency !== order.currency) {
    throw new StoreCheckoutError("CURRENCY_MISMATCH", "Moneda inconsistente.", 500);
  }

  await prisma.clickatonStoreOrder.update({
    where: { id: order.id },
    data: {
      paymentOrderId: payOrder.id,
      paymentProvider: payOrder.provider,
      paymentExternalReference: payOrder.externalReference,
      paymentIdempotencyKey: idempotencyKey,
      paymentStatus: "PENDING",
    },
  });

  logStoreCheckoutEvent("store_payment_preference_created", {
    orderId: order.id,
    publicId: order.publicId,
    paymentOrderId: payOrder.id,
    amountMinor: payOrder.amountMinor,
    reused: result.outcome === "reused",
  });

  return {
    checkoutUrl: payOrder.checkoutUrl,
    paymentOrderId: payOrder.id,
    reused: result.outcome === "reused",
  };
}
