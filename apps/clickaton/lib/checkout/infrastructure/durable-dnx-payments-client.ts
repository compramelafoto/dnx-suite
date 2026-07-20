import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createClickatonCheckoutService,
  type ClickatonCheckoutService,
  type DurableCheckoutOrder,
  type NormalizedCheckoutEvent as DurableEvent,
  type DnxPaymentsPersistence,
  type ClickatonCheckoutProviderBridge,
} from "@repo/payments/next";
import { hashCreateOrderPayload } from "../domain/idempotency";
import { CheckoutError } from "../domain/errors";
import { mapProviderStatusToDnx } from "../domain/mapping";
import type {
  CreatePaymentOrderInput,
  CreatePaymentOrderResult,
  NormalizedPaymentEvent,
  PaymentOrder,
  DnxNormalizedPaymentStatus,
} from "../domain/types";
import type { DnxPaymentsClient } from "./dnx-payments-client";

function mapDurableToPaymentOrder(order: DurableCheckoutOrder): PaymentOrder {
  return {
    id: order.id,
    provider: order.provider,
    status: order.status as DnxNormalizedPaymentStatus,
    amountMinor: order.amountMinor,
    currency: "ARS",
    externalReference: order.externalReference,
    checkoutUrl: order.checkoutUrl,
    sourceApp: "CLICKATON",
    sourceType: "REGISTRATION",
    sourceId: order.sourceId,
    idempotencyKey: order.idempotencyKey,
    payloadHash: order.payloadHash,
    attempt: order.attempt,
    createdAt: new Date(order.createdAt),
    updatedAt: new Date(order.updatedAt),
    approvedAt: order.approvedAt ? new Date(order.approvedAt) : null,
    lastEventId: order.lastEventId,
    lastEventAt: order.lastEventAt ? new Date(order.lastEventAt) : null,
  };
}

function signBody(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Cliente durable: DNX Payments es fuente de verdad (persistencia in-memory o Prisma).
 * Clickatón no duplica reglas de creación de orden.
 */
export function createDurableDnxPaymentsClient(deps: {
  persistence: DnxPaymentsPersistence;
  webhookSecret: string;
  checkoutBaseUrl?: string;
  notificationUrl?: string;
  providerBridge?: ClickatonCheckoutProviderBridge;
  isTestFixture?: boolean;
}): DnxPaymentsClient & {
  service: ClickatonCheckoutService;
  signWebhook(rawBody: string): string;
  simulateProviderEvent(input: {
    orderId: string;
    providerStatus: string;
    eventId?: string;
    amountMinor?: number;
    currency?: "ARS";
    sourceId?: string;
  }): Promise<NormalizedPaymentEvent>;
} {
  const service = createClickatonCheckoutService(deps.persistence, {
    ...(deps.providerBridge ? { providerBridge: deps.providerBridge } : {}),
  });

  return {
    service,

    signWebhook(rawBody: string) {
      return signBody(deps.webhookSecret, rawBody);
    },

    async simulateProviderEvent(input: {
      orderId: string;
      providerStatus: string;
      eventId?: string;
      amountMinor?: number;
      currency?: "ARS";
      sourceId?: string;
    }): Promise<NormalizedPaymentEvent> {
      const order = await service.getOrder(input.orderId);
      if (!order) {
        throw new CheckoutError("PAYMENT_ORDER_NOT_FOUND", "Orden desconocida.");
      }
      return {
        eventId: input.eventId ?? `evt_${Date.now()}`,
        orderId: order.id,
        status: mapProviderStatusToDnx(input.providerStatus),
        amountMinor: input.amountMinor ?? order.amountMinor,
        currency: input.currency ?? "ARS",
        provider: order.provider,
        externalReference: order.externalReference,
        sourceId: input.sourceId ?? order.sourceId,
        receivedAt: new Date(),
      };
    },

    async createOrder(input: CreatePaymentOrderInput): Promise<CreatePaymentOrderResult> {
      const result = await service.createOrder({
        sourceApp: "CLICKATON",
        sourceType: "REGISTRATION",
        sourceId: input.sourceId,
        idempotencyKey: input.idempotencyKey,
        payloadHash: hashCreateOrderPayload(input),
        amountMinor: input.amountMinor,
        currency: input.currency,
        description: input.description,
        successUrl: input.successUrl,
        pendingUrl: input.pendingUrl,
        failureUrl: input.failureUrl,
        payerEmail: input.payer?.email,
        checkoutBaseUrl: deps.checkoutBaseUrl,
        notificationUrl: deps.notificationUrl,
        isTestFixture: deps.isTestFixture,
      });
      if (result.outcome === "conflict") {
        return {
          outcome: "conflict",
          code: "IDEMPOTENCY_CONFLICT",
          message: result.message,
        };
      }
      return {
        outcome: result.outcome,
        order: mapDurableToPaymentOrder(result.order),
      };
    },

    async getOrder(orderId: string) {
      const order = await service.getOrder(orderId);
      return order ? mapDurableToPaymentOrder(order) : null;
    },

    async refreshOrder(orderId: string) {
      const order = await service.refreshOrder(orderId);
      return order ? mapDurableToPaymentOrder(order) : null;
    },

    verifyWebhook(
      headers: Record<string, string | undefined>,
      rawBody: string,
    ) {
      const sig = headers["x-dnx-payments-signature"] ?? headers["X-Dnx-Payments-Signature"];
      if (!sig) return { ok: false as const, code: "WEBHOOK_UNSIGNED" };
      const expected = signBody(deps.webhookSecret, rawBody);
      if (!safeEqualHex(sig, expected)) {
        return { ok: false as const, code: "WEBHOOK_INVALID_SIGNATURE" };
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return { ok: false as const, code: "WEBHOOK_INVALID_BODY" };
      }
      const body = parsed as Partial<NormalizedPaymentEvent> & { providerStatus?: string };
      if (!body.eventId || !body.orderId || !body.sourceId) {
        return { ok: false as const, code: "WEBHOOK_INVALID_BODY" };
      }
      const status =
        body.status ??
        (body.providerStatus ? mapProviderStatusToDnx(body.providerStatus) : null);
      if (!status) return { ok: false as const, code: "WEBHOOK_INVALID_BODY" };
      if (body.currency && body.currency !== "ARS") {
        return { ok: false as const, code: "WEBHOOK_CURRENCY" };
      }
      const event: NormalizedPaymentEvent = {
        eventId: String(body.eventId),
        orderId: String(body.orderId),
        status,
        amountMinor: Number(body.amountMinor ?? 0),
        currency: "ARS",
        provider: String(body.provider ?? "manual"),
        externalReference: String(body.externalReference ?? ""),
        sourceId: String(body.sourceId),
        receivedAt: new Date(),
        signature: sig,
      };
      return { ok: true as const, event };
    },

    async applyVerifiedEvent(event: NormalizedPaymentEvent) {
      const durableEvent: DurableEvent = {
        eventId: event.eventId,
        orderId: event.orderId,
        status: event.status,
        amountMinor: event.amountMinor,
        currency: event.currency,
        provider: event.provider,
        externalReference: event.externalReference,
        sourceId: event.sourceId,
        receivedAt: event.receivedAt.toISOString(),
      };
      const result = await service.applyNormalizedEvent(durableEvent);
      if (result.outcome === "not_found") return null;
      if (result.outcome === "conflict") {
        throw new CheckoutError(
          (result.conflictCode as CheckoutError["code"]) ?? "PAYMENT_CONFLICT",
          "Conflicto al aplicar evento de pago.",
          { conflictCode: result.conflictCode },
        );
      }
      return result.order ? mapDurableToPaymentOrder(result.order) : null;
    },
  };
}

export type DurableDnxPaymentsClient = ReturnType<typeof createDurableDnxPaymentsClient>;
