/**
 * After Orders 1:N observe/reconcile confirms PROCESSED_ACCREDITED,
 * build a NormalizedCheckoutEvent for Clickatón registration fulfillment (10D3I-H).
 *
 * Only when DNX checkout flag is ON. Observe-only (G) leaves fulfillment off.
 * Browser redirect never calls this.
 */
import type { DnxPaymentsPersistence } from "../../persistence/ports.js";
import type {
  ApplyNormalizedCheckoutEventResult,
  NormalizedCheckoutEvent,
} from "../clickaton-checkout/types.js";
import type { OrdersObserveResult } from "../orders-1n-observe/types.js";
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
        | "AMOUNT_MISSING";
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

  // Duplicate inbox: still try fulfillment if canonical available (idempotent apply).
  let canonical = observe.canonical;
  const providerOrderId = observe.providerOrderId;

  if (!canonical) {
    // Duplicate path often lacks GET — look up provider order + use APPROVED if already known.
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
    const intent = await input.persistence.intents.findById(
      paymentOrder.paymentIntentId,
    );
    const sourceId = parseRegistrationSourceId(intent?.externalReference);
    if (!sourceId || !intent?.externalReference) {
      return { fulfilled: false, reason: "EXTERNAL_REF_NOT_REGISTRATION" };
    }
    const event: NormalizedCheckoutEvent = {
      eventId: observe.eventId,
      orderId: paymentOrder.id,
      status: "APPROVED",
      amountMinor: Number(paymentOrder.amountMinor),
      currency: paymentOrder.currency as "ARS",
      provider: "mercadopago",
      externalReference: intent.externalReference,
      sourceId,
      receivedAt: new Date().toISOString(),
      origin: "HTTP_WEBHOOK",
      liveModeReported: false,
    };
    const apply = await input.applyNormalizedEvent(event);
    return { fulfilled: true, event, apply };
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
