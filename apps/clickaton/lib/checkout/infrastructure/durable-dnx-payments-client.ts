import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createClickatonCheckoutService,
  type ClickatonCheckoutService,
  type DurableCheckoutOrder,
  type NormalizedCheckoutEvent as DurableEvent,
  type DnxPaymentsPersistence,
  type ClickatonCheckoutProviderBridge,
  type FetchCanonicalOrder,
  type ClickatonOperationalSnapshotHook,
  verifyMercadoPagoWebhookSignature,
  parseMercadoPagoPaymentNotification,
  parseMercadoPagoOrdersNotification,
  isMercadoPagoOrdersWebhookType,
  observeOrdersWebhook,
  isOrders1nWebhookObserveEnabled,
  fulfillRegistrationFromOrdersObserve,
  isClickatonDnxCheckoutEnabled,
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
    sourceType: order.sourceType === "STORE_ORDER" ? "STORE_ORDER" : "REGISTRATION",
    sourceId: order.sourceId,
    idempotencyKey: order.idempotencyKey,
    payloadHash: order.payloadHash,
    attempt: order.attempt,
    statusDetail: order.statusDetail ?? null,
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
  /** HMAC interno DNX (`x-dnx-payments-signature`). Lo elegimos nosotros. */
  webhookSecret: string;
  /**
   * Secreto de firma de Mercado Pago (`x-signature`). Lo genera Mercado Pago en
   * su panel al registrar la URL de notificaciones — no es nuestro para elegir.
   * Debe estar separado de `webhookSecret`: si se comparten, el secreto de MP
   * pasa a habilitar también la ruta interna de eventos ya normalizados.
   * Ausente ⇒ cae a `webhookSecret` (compatibilidad con la configuración actual).
   */
  mercadoPagoWebhookSecret?: string;
  checkoutBaseUrl?: string;
  notificationUrl?: string;
  providerBridge?: ClickatonCheckoutProviderBridge;
  isTestFixture?: boolean;
  fetchOrdersCanonical?: FetchCanonicalOrder;
  buildOperationalSnapshot?: ClickatonOperationalSnapshotHook;
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
  ingestMercadoPagoSignedWebhook(input: {
    headers: Record<string, string | undefined>;
    rawBody: string;
    queryDataId?: string | null;
    queryType?: string | null;
    queryTopic?: string | null;
  }): Promise<
    | {
        ok: true;
        event: NormalizedPaymentEvent;
        apply: Awaited<
          ReturnType<ClickatonCheckoutService["applyProviderPaymentNotification"]>
        >;
      }
    | {
        ok: true;
        observed: true;
        outcome: "processed" | "duplicate";
        mismatchCount?: number;
        event?: NormalizedPaymentEvent;
        fulfillmentReason?: string;
      }
    | { ok: false; code: string }
  >;
} {
  // Firma de Mercado Pago: secreto dedicado si existe; si no, el actual.
  const mpWebhookSecret =
    deps.mercadoPagoWebhookSecret?.trim() || deps.webhookSecret;

  const service = createClickatonCheckoutService(deps.persistence, {
    ...(deps.providerBridge ? { providerBridge: deps.providerBridge } : {}),
    ...(deps.buildOperationalSnapshot
      ? { buildOperationalSnapshot: deps.buildOperationalSnapshot }
      : {}),
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
      const liveBridge = service.providerMode === "mercado_pago_production";
      const result = await service.createOrder({
        sourceApp: "CLICKATON",
        sourceType: input.sourceType,
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
        environment: liveBridge ? "production" : "sandbox",
        isTestFixture: liveBridge ? false : deps.isTestFixture,
        ...(input.cardPayment ? { cardPayment: input.cardPayment } : {}),
        ...(input.editionFinance
          ? {
              editionFinance: {
                snapshot: input.editionFinance.snapshot,
                ...(input.editionFinance.collectorAccessToken
                  ? { collectorAccessToken: input.editionFinance.collectorAccessToken }
                  : {}),
              },
            }
          : {}),
      });
      if (result.outcome === "conflict") {
        return {
          outcome: "conflict",
          code: "IDEMPOTENCY_CONFLICT",
          message: result.message,
        };
      }

      // Persist allocations durables (idempotente) desde snapshot.
      if (input.editionFinance && result.order) {
        try {
          const { persistOrderAllocationsFromSnapshot } = await import(
            "@/lib/admin/edition-finance/infrastructure/persist-order-allocations"
          );
          await persistOrderAllocationsFromSnapshot({
            paymentOrderId: result.order.id,
            snapshot: input.editionFinance.snapshot,
            providerReference: result.order.externalReference,
            status: "CREATED",
          });
        } catch (err) {
          // No tumbar checkout si la tabla aún no migró en el entorno; audit via log.
          console.error(
            JSON.stringify({
              event: "edition_allocations_persist_failed",
              orderId: result.order.id,
              reason: err instanceof Error ? err.message.slice(0, 120) : "unknown",
            }),
          );
        }
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

    async ingestMercadoPagoSignedWebhook(input: {
      headers: Record<string, string | undefined>;
      rawBody: string;
      queryDataId?: string | null;
      queryType?: string | null;
      queryTopic?: string | null;
    }) {
      const signatureHeader =
        input.headers["x-signature"] ?? input.headers["X-Signature"];
      const requestIdHeader =
        input.headers["x-request-id"] ?? input.headers["X-Request-Id"];

      if (!signatureHeader) {
        return { ok: false as const, code: "WEBHOOK_UNSIGNED" };
      }

      // Orders 1:N observe (+ optional registration fulfillment when H checkout flag ON).
      const ordersParsed = parseMercadoPagoOrdersNotification({
        rawBody: input.rawBody,
        queryDataId: input.queryDataId,
        queryType: input.queryType,
      });
      if (ordersParsed.ok && isMercadoPagoOrdersWebhookType(ordersParsed.notification.type)) {
        if (!isOrders1nWebhookObserveEnabled()) {
          return { ok: false as const, code: "ORDERS_OBSERVE_FLAG_OFF" };
        }
        const observed = await observeOrdersWebhook({
          headers: input.headers,
          rawBody: input.rawBody,
          queryDataId: input.queryDataId,
          queryType: input.queryType,
          webhookSecret: mpWebhookSecret,
          persistence: deps.persistence,
          fetchCanonicalOrder: deps.fetchOrdersCanonical,
          allowCliBypass: false,
          deliveryClass: "HTTP_DELIVERED_FROM_MP",
          environment: "sandbox",
        });
        if (!observed.ok) {
          return { ok: false as const, code: observed.code };
        }

        const fulfillment = await fulfillRegistrationFromOrdersObserve({
          observe: observed,
          persistence: deps.persistence,
          applyNormalizedEvent: (e) => service.applyNormalizedEvent(e),
          checkoutFlagEnabled: isClickatonDnxCheckoutEnabled(),
          environment: "sandbox",
          // GET Order = fuente de verdad también en el reintento duplicado.
          fetchCanonicalOrder: deps.fetchOrdersCanonical,
        });

        if (fulfillment.fulfilled) {
          const event: NormalizedPaymentEvent = {
            eventId: fulfillment.event.eventId,
            orderId: fulfillment.event.orderId,
            status: fulfillment.event.status as DnxNormalizedPaymentStatus,
            amountMinor: fulfillment.event.amountMinor,
            currency: "ARS",
            provider: String(fulfillment.event.provider),
            externalReference: fulfillment.event.externalReference,
            sourceId: fulfillment.event.sourceId,
            receivedAt: new Date(fulfillment.event.receivedAt),
            signature: "x-signature",
          };
          return {
            ok: true as const,
            observed: true as const,
            outcome: observed.outcome,
            mismatchCount: observed.mismatches.length,
            event,
          };
        }

        return {
          ok: true as const,
          observed: true as const,
          outcome: observed.outcome,
          mismatchCount: observed.mismatches.length,
          fulfillmentReason: fulfillment.reason,
        };
      }

      const parsed = parseMercadoPagoPaymentNotification({
        rawBody: input.rawBody,
        queryDataId: input.queryDataId,
        queryType: input.queryType,
        queryTopic: input.queryTopic,
      });
      if (!parsed.ok) {
        return { ok: false as const, code: parsed.code };
      }

      // Sin maxSkewMs: MP puede reintentar tarde; HMAC sigue siendo obligatorio.
      const verified = verifyMercadoPagoWebhookSignature({
        signatureHeader,
        requestIdHeader,
        dataId: parsed.notification.dataId,
        secret: mpWebhookSecret,
      });
      if (!verified.ok) {
        if (verified.reason === "missing_data_id") {
          return { ok: false as const, code: "WEBHOOK_MISSING_DATA_ID" };
        }
        if (verified.reason === "missing_request_id") {
          return { ok: false as const, code: "WEBHOOK_MISSING_REQUEST_ID" };
        }
        if (verified.reason === "missing_secret") {
          return { ok: false as const, code: "WEBHOOK_SECRET_MISSING" };
        }
        return { ok: false as const, code: "WEBHOOK_INVALID_SIGNATURE" };
      }

      const paymentId = parsed.notification.dataId;
      const requestId = String(requestIdHeader).slice(0, 80);
      const eventId = `mp_wh_${requestId}_${paymentId}`;

      const apply = await service.applyProviderPaymentNotification({
        providerPaymentId: paymentId,
        eventId,
        liveModeReported: parsed.notification.liveMode,
        action: parsed.notification.action,
      });

      if (apply.outcome === "not_found") {
        return { ok: false as const, code: "WEBHOOK_ORDER_NOT_FOUND" };
      }
      if (apply.outcome === "conflict") {
        return {
          ok: false as const,
          code: apply.conflictCode ?? "PAYMENT_CONFLICT",
        };
      }

      const order = apply.order;
      if (!order) {
        return { ok: false as const, code: "WEBHOOK_ORDER_NOT_FOUND" };
      }

      const event: NormalizedPaymentEvent = {
        eventId,
        orderId: order.id,
        status: order.status as DnxNormalizedPaymentStatus,
        amountMinor: order.amountMinor,
        currency: "ARS",
        provider: order.provider,
        externalReference: order.externalReference,
        sourceId: order.sourceId,
        receivedAt: new Date(),
        signature: "x-signature",
      };
      return { ok: true as const, event, apply };
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
