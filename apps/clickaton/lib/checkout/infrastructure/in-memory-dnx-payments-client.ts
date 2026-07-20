import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { hashCreateOrderPayload } from "../domain/idempotency";
import { mapProviderStatusToDnx } from "../domain/mapping";
import { CheckoutError } from "../domain/errors";
import type {
  CreatePaymentOrderInput,
  CreatePaymentOrderResult,
  DnxNormalizedPaymentStatus,
  NormalizedPaymentEvent,
  PaymentOrder,
} from "../domain/types";
import type { DnxPaymentsClient, FakeProviderScenario } from "./dnx-payments-client";

export type InMemoryDnxPaymentsStore = {
  orders: Map<string, PaymentOrder>;
  byIdempotency: Map<string, string>;
  processedEvents: Set<string>;
  locks: Map<string, Promise<unknown>>;
  webhookSecret: string;
  nextScenario: FakeProviderScenario;
  forceProviderStatus: string | null;
  checkoutBaseUrl: string;
};

export function createInMemoryDnxPaymentsStore(
  overrides?: Partial<InMemoryDnxPaymentsStore>,
): InMemoryDnxPaymentsStore {
  return {
    orders: new Map(),
    byIdempotency: new Map(),
    processedEvents: new Set(),
    locks: new Map(),
    webhookSecret: overrides?.webhookSecret ?? "test-webhook-secret",
    nextScenario: overrides?.nextScenario ?? "created",
    forceProviderStatus: overrides?.forceProviderStatus ?? null,
    checkoutBaseUrl: overrides?.checkoutBaseUrl ?? "https://payments.test/checkout",
    ...overrides,
  };
}

async function withKeyLock<T>(
  store: InMemoryDnxPaymentsStore,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = store.locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const chained = prev.then(() => gate);
  store.locks.set(key, chained);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function cloneOrder(o: PaymentOrder): PaymentOrder {
  return {
    ...o,
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
    approvedAt: o.approvedAt ? new Date(o.approvedAt) : null,
    lastEventAt: o.lastEventAt ? new Date(o.lastEventAt) : null,
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

export function createInMemoryDnxPaymentsClient(
  store: InMemoryDnxPaymentsStore = createInMemoryDnxPaymentsStore(),
): DnxPaymentsClient & {
  store: InMemoryDnxPaymentsStore;
  simulateProviderEvent(input: {
    orderId: string;
    providerStatus: string;
    eventId?: string;
    amountMinor?: number;
    currency?: "ARS";
    sourceId?: string;
  }): NormalizedPaymentEvent;
  signWebhook(rawBody: string): string;
} {
  const client: DnxPaymentsClient & {
    store: InMemoryDnxPaymentsStore;
    simulateProviderEvent: (input: {
      orderId: string;
      providerStatus: string;
      eventId?: string;
      amountMinor?: number;
      currency?: "ARS";
      sourceId?: string;
    }) => NormalizedPaymentEvent;
    signWebhook: (rawBody: string) => string;
  } = {
    store,

    signWebhook(rawBody: string) {
      return signBody(store.webhookSecret, rawBody);
    },

    simulateProviderEvent(input) {
      const order = store.orders.get(input.orderId);
      if (!order) {
        throw new CheckoutError("PAYMENT_ORDER_NOT_FOUND", "Orden desconocida.");
      }
      const status = mapProviderStatusToDnx(input.providerStatus);
      return {
        eventId: input.eventId ?? `evt_${randomUUID()}`,
        orderId: order.id,
        status,
        amountMinor: input.amountMinor ?? order.amountMinor,
        currency: input.currency ?? order.currency,
        provider: order.provider,
        externalReference: order.externalReference,
        sourceId: input.sourceId ?? order.sourceId,
        receivedAt: new Date(),
      };
    },

    async createOrder(input: CreatePaymentOrderInput): Promise<CreatePaymentOrderResult> {
      if (store.nextScenario === "timeout") {
        throw new CheckoutError("PROVIDER_UNAVAILABLE", "El proveedor no respondió a tiempo.");
      }
      if (store.nextScenario === "temporary_error") {
        throw new CheckoutError("PROVIDER_UNAVAILABLE", "Error temporal del proveedor.");
      }

      const payloadHash = hashCreateOrderPayload(input);
      return withKeyLock(store, input.idempotencyKey, async () => {
        const existingId = store.byIdempotency.get(input.idempotencyKey);
        if (existingId) {
          const existing = store.orders.get(existingId);
          if (!existing) {
            throw new CheckoutError("PAYMENT_CONFLICT", "Registro de idempotencia inconsistente.");
          }
          if (existing.payloadHash !== payloadHash) {
            return {
              outcome: "conflict",
              code: "IDEMPOTENCY_CONFLICT",
              message: "La clave de idempotencia ya fue usada con otro payload.",
            };
          }
          if (
            existing.status === "EXPIRED" ||
            existing.status === "CANCELLED" ||
            existing.status === "REJECTED"
          ) {
            // permitir nuevo intento con distinta key (caller); misma key reutiliza fallida
            return { outcome: "reused", order: cloneOrder(existing) };
          }
          return { outcome: "reused", order: cloneOrder(existing) };
        }

        // Reutilizar orden pendiente válida de la misma inscripción
        for (const o of store.orders.values()) {
          if (
            o.sourceId === input.sourceId &&
            (o.status === "CREATED" || o.status === "PENDING" || o.status === "PROCESSING")
          ) {
            if (o.amountMinor !== input.amountMinor || o.currency !== input.currency) {
              return {
                outcome: "conflict",
                code: "IDEMPOTENCY_CONFLICT",
                message: "Hay una orden pendiente con monto o moneda distintos.",
              };
            }
            store.byIdempotency.set(input.idempotencyKey, o.id);
            return { outcome: "reused", order: cloneOrder(o) };
          }
        }

        const attempt =
          [...store.orders.values()].filter((o) => o.sourceId === input.sourceId).length + 1;
        const id = `dnx_ord_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
        const externalReference = `clickaton:registration:${input.sourceId}`;
        let status: DnxNormalizedPaymentStatus = "CREATED";
        if (store.forceProviderStatus) {
          status = mapProviderStatusToDnx(store.forceProviderStatus);
        } else if (store.nextScenario === "pending") status = "PENDING";
        else if (store.nextScenario === "approved") status = "APPROVED";
        else if (store.nextScenario === "rejected") status = "REJECTED";
        else if (store.nextScenario === "cancelled") status = "CANCELLED";
        else if (store.nextScenario === "expired") status = "EXPIRED";

        const now = new Date();
        const checkoutToken = createHash("sha256").update(`${id}:${payloadHash}`).digest("hex").slice(0, 24);
        const order: PaymentOrder = {
          id,
          provider: "fake",
          status,
          amountMinor: input.amountMinor,
          currency: "ARS",
          externalReference,
          checkoutUrl: `${store.checkoutBaseUrl}/${id}?t=${checkoutToken}`,
          sourceApp: "CLICKATON",
          sourceType: "REGISTRATION",
          sourceId: input.sourceId,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          attempt,
          createdAt: now,
          updatedAt: now,
          approvedAt: status === "APPROVED" ? now : null,
          lastEventId: null,
          lastEventAt: null,
        };
        store.orders.set(id, order);
        store.byIdempotency.set(input.idempotencyKey, id);
        return { outcome: "created", order: cloneOrder(order) };
      });
    },

    async getOrder(orderId: string) {
      if (store.nextScenario === "unknown_order") return null;
      const o = store.orders.get(orderId);
      return o ? cloneOrder(o) : null;
    },

    async refreshOrder(orderId: string) {
      const o = store.orders.get(orderId);
      if (!o) return null;
      // Fake: refresh = lectura server-side (sin confiar en redirect).
      o.updatedAt = new Date();
      store.orders.set(orderId, o);
      return cloneOrder(o);
    },

    verifyWebhook(headers, rawBody) {
      const sig = headers["x-dnx-payments-signature"] ?? headers["X-Dnx-Payments-Signature"];
      if (!sig) return { ok: false as const, code: "WEBHOOK_UNSIGNED" };
      const expected = signBody(store.webhookSecret, rawBody);
      if (!safeEqualHex(sig, expected)) {
        return { ok: false as const, code: "WEBHOOK_INVALID_SIGNATURE" };
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return { ok: false as const, code: "WEBHOOK_INVALID_BODY" };
      }
      const body = parsed as Partial<NormalizedPaymentEvent> & {
        providerStatus?: string;
      };
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
        provider: String(body.provider ?? "fake"),
        externalReference: String(body.externalReference ?? ""),
        sourceId: String(body.sourceId),
        receivedAt: new Date(),
        signature: sig,
      };
      return { ok: true as const, event };
    },

    async applyVerifiedEvent(event: NormalizedPaymentEvent) {
      if (store.processedEvents.has(event.eventId)) {
        const existing = store.orders.get(event.orderId);
        return existing ? cloneOrder(existing) : null;
      }
      const order = store.orders.get(event.orderId);
      if (!order) return null;

      if (store.nextScenario === "amount_mismatch" || event.amountMinor !== order.amountMinor) {
        if (event.amountMinor !== order.amountMinor) {
          throw new CheckoutError(
            "PAYMENT_AMOUNT_MISMATCH",
            "El monto del evento no coincide con la orden.",
            { expected: order.amountMinor, got: event.amountMinor },
          );
        }
      }
      if (event.currency !== order.currency) {
        throw new CheckoutError(
          "PAYMENT_CURRENCY_MISMATCH",
          "La moneda del evento no coincide con la orden.",
        );
      }
      if (event.sourceId !== order.sourceId) {
        throw new CheckoutError(
          "PAYMENT_CONFLICT",
          "El evento no pertenece a la inscripción de la orden.",
        );
      }

      order.status = event.status;
      order.updatedAt = new Date();
      order.lastEventId = event.eventId;
      order.lastEventAt = event.receivedAt;
      if (event.status === "APPROVED") order.approvedAt = event.receivedAt;
      store.orders.set(order.id, order);
      store.processedEvents.add(event.eventId);
      return cloneOrder(order);
    },
  };

  return client;
}
