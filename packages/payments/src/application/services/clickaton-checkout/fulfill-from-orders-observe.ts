/**
 * After Orders 1:N observe/reconcile confirms PROCESSED_ACCREDITED,
 * build a NormalizedCheckoutEvent for Clickatón registration fulfillment (10D3I-H).
 *
 * Only when DNX checkout flag is ON. Observe-only (G) leaves fulfillment off.
 * Browser redirect never calls this.
 *
 * SOURCE OF TRUTH (confirmado por Mercado Pago): el webhook `order` es sólo un
 * disparador de notificación. Ningún efecto de negocio se produce a partir del
 * payload recibido: el estado siempre proviene de GET /v1/orders/{id}. Cuando el
 * observe no trae vista canónica (por ejemplo, reintento duplicado que corta
 * antes del GET), este servicio ejecuta su propio GET; si no puede, falla cerrado.
 */
import type { DnxPaymentsPersistence } from "../../persistence/ports.js";
import type {
  ApplyNormalizedCheckoutEventResult,
  NormalizedCheckoutEvent,
} from "../clickaton-checkout/types.js";
import type { CanonicalOrderView, OrdersObserveResult } from "../orders-1n-observe/types.js";
import type { FetchCanonicalOrder } from "../orders-1n-observe/observe-orders-webhook.js";
import { toCanonicalOrderView } from "../orders-1n-observe/reconcile.js";
import { isClickatonDnxCheckoutEnabled } from "../clickaton-checkout/checkout-dnx-flag.js";

const REG_PREFIXES = ["clickaton:registration:", "clickaton-registration-"] as const;

function parseRegistrationSourceId(ext: string | null | undefined): string | null {
  if (!ext) return null;
  for (const prefix of REG_PREFIXES) {
    if (ext.startsWith(prefix)) return ext.slice(prefix.length);
  }
  return null;
}

function mapOrdersStatusToNormalized(
  status: string,
): NormalizedCheckoutEvent["status"] | null {
  const s = status.trim().toUpperCase();
  if (s === "PROCESSED_ACCREDITED" || s === "PROCESSED" || s === "APPROVED") {
    return "APPROVED";
  }
  if (s === "REJECTED" || s === "FAILED" || s === "CANCELLED" || s === "CANCELED") {
    return "REJECTED";
  }
  if (s === "EXPIRED") return "EXPIRED";
  return null;
}

export type FulfillFromOrdersObserveInput = {
  observe: OrdersObserveResult;
  persistence: DnxPaymentsPersistence;
  applyNormalizedEvent: (
    event: NormalizedCheckoutEvent,
  ) => Promise<ApplyNormalizedCheckoutEventResult>;
  /** Override process env flag (tests / CLI). */
  checkoutFlagEnabled?: boolean;
  environment?: "sandbox" | "production";
  /**
   * GET /v1/orders/{id}. Requerido para fulfillment cuando el observe no trajo
   * vista canónica (reintento duplicado). Sin esto, se falla cerrado.
   */
  fetchCanonicalOrder?: FetchCanonicalOrder;
};

export type FulfillFromOrdersObserveResult =
  | {
      fulfilled: true;
      event: NormalizedCheckoutEvent;
      apply: ApplyNormalizedCheckoutEventResult;
    }
  | {
      fulfilled: false;
      reason:
        | "CHECKOUT_FLAG_OFF"
        | "OBSERVE_NOT_OK"
        | "HAS_MISMATCHES"
        | "NO_CANONICAL"
        | "STATUS_NOT_ACCREDITED"
        | "EXTERNAL_REF_NOT_REGISTRATION"
        | "PROVIDER_ORDER_NOT_FOUND"
        | "PAYMENT_ORDER_NOT_FOUND"
        | "AMOUNT_MISSING"
        | "CANONICAL_REQUIRED"
        | "GET_ORDER_FAILED";
    };

export async function fulfillRegistrationFromOrdersObserve(
  input: FulfillFromOrdersObserveInput,
): Promise<FulfillFromOrdersObserveResult> {
  const flagOn =
    input.checkoutFlagEnabled ?? isClickatonDnxCheckoutEnabled();
  if (!flagOn) {
    return { fulfilled: false, reason: "CHECKOUT_FLAG_OFF" };
  }

  const observe = input.observe;
  if (!observe.ok) {
    return { fulfilled: false, reason: "OBSERVE_NOT_OK" };
  }
  if (observe.mismatches.length > 0) {
    return { fulfilled: false, reason: "HAS_MISMATCHES" };
  }

  /**
   * GET Order = fuente de verdad. Un reintento duplicado corta en observe antes
   * del GET y llega sin vista canónica: en ese caso hacemos el GET acá. Nunca se
   * asume APPROVED a partir del webhook ni del estado persistido.
   */
  let canonical: CanonicalOrderView | null = observe.canonical;
  const providerOrderId = observe.providerOrderId;

  if (!canonical) {
    if (!input.fetchCanonicalOrder) {
      return { fulfilled: false, reason: "CANONICAL_REQUIRED" };
    }
    try {
      const fetched = await input.fetchCanonicalOrder(providerOrderId);
      if (!fetched) {
        return { fulfilled: false, reason: "GET_ORDER_FAILED" };
      }
      canonical = toCanonicalOrderView(fetched);
    } catch {
      return { fulfilled: false, reason: "GET_ORDER_FAILED" };
    }
  }

  const normalized = mapOrdersStatusToNormalized(String(canonical.status));
  if (normalized !== "APPROVED") {
    return { fulfilled: false, reason: "STATUS_NOT_ACCREDITED" };
  }

  const ext = canonical.externalReference;
  const sourceId = parseRegistrationSourceId(ext);
  if (!sourceId || !ext) {
    return { fulfilled: false, reason: "EXTERNAL_REF_NOT_REGISTRATION" };
  }

  const po = await input.persistence.providerOrders.findByProviderOrderId(
    "mercadopago",
    input.environment ?? "sandbox",
    providerOrderId,
  );
  if (!po) {
    return { fulfilled: false, reason: "PROVIDER_ORDER_NOT_FOUND" };
  }
  const paymentOrder = await input.persistence.paymentOrders.findById(
    po.paymentOrderId,
  );
  if (!paymentOrder) {
    return { fulfilled: false, reason: "PAYMENT_ORDER_NOT_FOUND" };
  }

  const amountMinor =
    canonical.totalMinor != null
      ? Number(canonical.totalMinor)
      : Number(paymentOrder.amountMinor);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return { fulfilled: false, reason: "AMOUNT_MISSING" };
  }

  const event: NormalizedCheckoutEvent = {
    eventId: observe.eventId,
    orderId: paymentOrder.id,
    status: "APPROVED",
    amountMinor,
    currency: (canonical.currency ?? paymentOrder.currency) as "ARS",
    provider: "mercadopago",
    externalReference: ext,
    sourceId,
    receivedAt: new Date().toISOString(),
    origin: "HTTP_WEBHOOK",
    liveModeReported: false,
  };

  const apply = await input.applyNormalizedEvent(event);
  return { fulfilled: true, event, apply };
}
