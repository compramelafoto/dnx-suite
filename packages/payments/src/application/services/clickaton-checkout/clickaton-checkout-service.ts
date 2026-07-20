import { createHash, randomUUID } from "node:crypto";
import type { DnxPaymentsPersistence } from "../../persistence/ports";
import {
  createIntentUnit,
  registerProviderOrderUnit,
} from "../../persistence/transactions";
import type { PersistedPaymentOrder, PersistedProviderOrder } from "../../persistence/types";
import { ensureClickatonPlatformRecipients } from "./ensure-platform-recipients";
import {
  isReusableNormalized,
  mapNormalizedToPaymentOrderStatus,
  mapNormalizedToProviderMappedStatus,
  mapPaymentOrderStatusToNormalized,
} from "./map-status";
import type {
  ApplyNormalizedCheckoutEventResult,
  CreateClickatonCheckoutOrderInput,
  CreateClickatonCheckoutOrderResult,
  DurableCheckoutOrder,
  NormalizedCheckoutEvent,
  ReconcileClickatonCheckoutResult,
} from "./types";

const SOURCE_PRODUCT = "clickaton";
const PROVIDER = "manual" as const;
const DEFAULT_CHECKOUT_BASE = "https://payments.test/checkout";

function externalRefForRegistration(sourceId: string): string {
  return `clickaton:registration:${sourceId}`;
}

function extractCheckoutUrl(
  providerOrder: PersistedProviderOrder | null,
  paymentOrder: PersistedPaymentOrder | null,
): string | null {
  const fromProvider = providerOrder?.rawResponseSanitized?.checkoutUrl;
  if (typeof fromProvider === "string" && fromProvider.length > 0) return fromProvider;
  const fromOrder = paymentOrder?.distributionSnapshot?.checkoutUrl;
  if (typeof fromOrder === "string" && fromOrder.length > 0) return fromOrder;
  return null;
}

function extractSourceId(externalReference: string): string {
  const prefix = "clickaton:registration:";
  return externalReference.startsWith(prefix)
    ? externalReference.slice(prefix.length)
    : externalReference;
}

async function buildDurableOrder(
  db: DnxPaymentsPersistence,
  paymentOrder: PersistedPaymentOrder,
  opts?: { idempotencyKey?: string; payloadHash?: string },
): Promise<DurableCheckoutOrder> {
  const intent = await db.intents.findById(paymentOrder.paymentIntentId);
  const providerOrder = await db.providerOrders.findByPaymentOrderId(paymentOrder.id);
  const audits = await db.audit.list({
    aggregateType: "payment_order",
    aggregateId: paymentOrder.id,
  });
  const eventAudits = audits
    .filter((a) => a.action === "clickaton.checkout.event.applied")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const lastEvent = eventAudits[0];
  const snap = paymentOrder.distributionSnapshot ?? {};
  const fromSnap =
    typeof snap.normalizedStatus === "string"
      ? (snap.normalizedStatus as import("./types.js").NormalizedCheckoutStatus)
      : null;
  const fromProvider =
    typeof providerOrder?.rawResponseSanitized?.normalizedStatus === "string"
      ? (providerOrder.rawResponseSanitized.normalizedStatus as import("./types.js").NormalizedCheckoutStatus)
      : null;
  const status =
    fromSnap ?? fromProvider ?? mapPaymentOrderStatusToNormalized(paymentOrder.status);
  const approvedAt =
    status === "APPROVED"
      ? (providerOrder?.updatedAt ?? paymentOrder.updatedAt)
      : null;
  const checkoutUrl = extractCheckoutUrl(providerOrder, paymentOrder);
  const idempotencyKey =
    opts?.idempotencyKey ??
    (typeof snap.idempotencyKey === "string" ? snap.idempotencyKey : "");
  const payloadHash =
    opts?.payloadHash ?? (typeof snap.payloadHash === "string" ? snap.payloadHash : "");
  const attempt = typeof snap.attempt === "number" ? snap.attempt : 1;

  return {
    id: paymentOrder.id,
    intentId: paymentOrder.paymentIntentId,
    provider: paymentOrder.provider,
    status,
    amountMinor: Number(paymentOrder.amountMinor),
    currency: paymentOrder.currency,
    externalReference: intent?.externalReference ?? externalRefForRegistration("unknown"),
    checkoutUrl,
    sourceApp: "CLICKATON",
    sourceType: "REGISTRATION",
    sourceId: intent ? extractSourceId(intent.externalReference) : "unknown",
    idempotencyKey,
    payloadHash,
    attempt,
    providerOrderId: providerOrder?.providerOrderId ?? null,
    createdAt: paymentOrder.createdAt,
    updatedAt: paymentOrder.updatedAt,
    approvedAt,
    lastEventId:
      lastEvent && typeof lastEvent.metadata?.eventId === "string"
        ? lastEvent.metadata.eventId
        : null,
    lastEventAt: lastEvent?.createdAt ?? null,
    eventsCount: eventAudits.length,
  };
}

export function createClickatonCheckoutService(db: DnxPaymentsPersistence) {
  return {
    async createOrder(
      input: CreateClickatonCheckoutOrderInput,
    ): Promise<CreateClickatonCheckoutOrderResult> {
      const environment = input.environment ?? "sandbox";
      const now = new Date().toISOString();
      const externalReference = externalRefForRegistration(input.sourceId);
      const { ownerRecipientId, partnerRecipientId } =
        await ensureClickatonPlatformRecipients(db);

      // Idempotency durable
      const existingIdempo = await db.idempotency.find(
        PROVIDER,
        environment,
        input.idempotencyKey,
      );
      if (existingIdempo) {
        if (existingIdempo.payloadHash !== input.payloadHash) {
          return {
            outcome: "conflict",
            code: "IDEMPOTENCY_CONFLICT",
            message: "La clave de idempotencia ya fue usada con otro payload.",
          };
        }
        if (existingIdempo.aggregateId) {
          const order = await db.paymentOrders.findById(existingIdempo.aggregateId);
          if (order) {
            const durable = await buildDurableOrder(db, order, {
              idempotencyKey: input.idempotencyKey,
              payloadHash: input.payloadHash,
            });
            return { outcome: "reused", order: durable };
          }
        }
      }

      // Reuse active pending order for same registration
      let intent = await db.intents.findByExternalReference(SOURCE_PRODUCT, externalReference);
      if (intent) {
        const orders = await db.paymentOrders.listByPaymentIntentId(intent.id);
        for (const o of orders) {
          const durable = await buildDurableOrder(db, o);
          if (isReusableNormalized(durable.status)) {
            if (
              durable.amountMinor !== input.amountMinor ||
              durable.currency !== input.currency
            ) {
              return {
                outcome: "conflict",
                code: "IDEMPOTENCY_CONFLICT",
                message: "Hay una orden pendiente con monto o moneda distintos.",
              };
            }
            return { outcome: "reused", order: durable };
          }
        }
      }

      if (!intent) {
        const intentId = `dnx_intent_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
        try {
          await createIntentUnit(db, {
            intent: {
              id: intentId,
              sourceProduct: SOURCE_PRODUCT,
              externalReference,
              currency: input.currency,
              totalMinor: BigInt(input.amountMinor),
              status: "READY",
              environment,
              isTestFixture: Boolean(input.isTestFixture),
              distributionSnapshot: {
                description: input.description,
                sourceType: input.sourceType,
              },
              createdAt: now,
              updatedAt: now,
            },
            audit: {
              id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
              actorType: "system",
              action: "clickaton.checkout.intent.create",
              aggregateType: "payment_intent",
              aggregateId: intentId,
              provider: PROVIDER,
              environment,
              result: "SUCCEEDED",
              metadata: { sourceId: input.sourceId },
              createdAt: now,
            },
          });
          intent = await db.intents.findById(intentId);
        } catch {
          // Carrera concurrente: otro proceso creó el intent.
          intent = await db.intents.findByExternalReference(
            SOURCE_PRODUCT,
            externalReference,
          );
        }
      }
      if (!intent) {
        throw new Error("intent_create_failed");
      }

      const priorOrders = await db.paymentOrders.listByPaymentIntentId(intent.id);
      const attempt = priorOrders.length + 1;
      const orderId = `dnx_ord_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const idempotencyId = `idem_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

      const reserveResult = await db.idempotency.reserve({
        id: idempotencyId,
        operation: "clickaton.create_checkout_order",
        provider: PROVIDER,
        environment,
        idempotencyKey: input.idempotencyKey,
        payloadHash: input.payloadHash,
        aggregateType: "payment_order",
        aggregateId: orderId,
        now,
      });

      if (reserveResult.kind === "CONFLICT") {
        await db.audit.append({
          id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          actorType: "system",
          action: "clickaton.checkout.order.reserve",
          aggregateType: "payment_order",
          aggregateId: orderId,
          provider: PROVIDER,
          environment,
          result: "FAILED",
          errorCode: "IDEMPOTENCY_PAYLOAD_CONFLICT",
          createdAt: now,
        });
        return {
          outcome: "conflict",
          code: "IDEMPOTENCY_CONFLICT",
          message: "La clave de idempotencia ya fue usada con otro payload.",
        };
      }

      if (reserveResult.kind === "SAME_PAYLOAD") {
        const existingId = reserveResult.record.aggregateId;
        if (existingId) {
          const existing = await db.paymentOrders.findById(existingId);
          if (existing) {
            const durable = await buildDurableOrder(db, existing, {
              idempotencyKey: input.idempotencyKey,
              payloadHash: input.payloadHash,
            });
            return { outcome: "reused", order: durable };
          }
        }
      }

      // CREATED — persist payment order
      await db.paymentOrders.save({
        id: orderId,
        paymentIntentId: intent.id,
        provider: PROVIDER,
        environment,
        status: "AWAITING_PROVIDER",
        amountMinor: BigInt(input.amountMinor),
        currency: input.currency,
        ownerRecipientId,
        idempotencyRecordId: reserveResult.record.id,
        isTestFixture: Boolean(input.isTestFixture),
        distributionSnapshot: {
          checkoutUrl: null,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          attempt,
          successPath: input.successUrl.split("?")[0],
          pendingPath: input.pendingUrl.split("?")[0],
          failurePath: input.failureUrl.split("?")[0],
        },
        createdAt: now,
        updatedAt: now,
      });
      await db.audit.append({
        id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        actorType: "system",
        action: "clickaton.checkout.order.reserve",
        aggregateType: "payment_order",
        aggregateId: orderId,
        provider: PROVIDER,
        environment,
        result: "SUCCEEDED",
        createdAt: now,
      });

      const reserve = reserveResult.record;

      // Fake provider call (outside TX) — deterministic checkout URL
      const checkoutBase = (input.checkoutBaseUrl ?? DEFAULT_CHECKOUT_BASE).replace(/\/$/, "");
      const checkoutToken = createHash("sha256")
        .update(`${orderId}:${input.payloadHash}`)
        .digest("hex")
        .slice(0, 24);
      const checkoutUrl = `${checkoutBase}/${orderId}?t=${checkoutToken}`;
      const providerOrderId = `fake_${orderId}`;
      const providerRowId = `dnx_po_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const now2 = new Date().toISOString();

      try {
        await registerProviderOrderUnit(db, {
          providerOrder: {
            id: providerRowId,
            paymentOrderId: orderId,
            provider: PROVIDER,
            environment,
            providerOrderId,
            providerStatus: "created",
            mappedStatus: "OPEN",
            totalMinor: BigInt(input.amountMinor),
            currency: input.currency,
            rawResponseSanitized: {
              checkoutUrl,
              sourceApp: "CLICKATON",
              sourceType: "REGISTRATION",
              sourceId: input.sourceId,
            },
            lastFetchedAt: now2,
            createdAt: now2,
            updatedAt: now2,
          },
          splits: [
            {
              id: `split_own_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
              providerOrderId: providerRowId,
              recipientId: ownerRecipientId,
              providerReceiverReference: "clickaton-owner",
              receiverType: "OWNER",
              amountMinor: BigInt(input.amountMinor),
              currency: input.currency,
              status: "PLANNED",
              createdAt: now2,
              updatedAt: now2,
            },
            {
              id: `split_par_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
              providerOrderId: providerRowId,
              recipientId: partnerRecipientId,
              providerReceiverReference: "clickaton-partner-stub",
              receiverType: "PARTNER",
              amountMinor: 0n,
              currency: input.currency,
              description: "stub-no-split",
              status: "PLANNED",
              createdAt: now2,
              updatedAt: now2,
            },
          ],
          idempotencyId: reserve.id,
          now: now2,
          responseHash: createHash("sha256").update(checkoutUrl).digest("hex"),
          audit: {
            id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
            actorType: "system",
            action: "clickaton.checkout.provider.registered",
            aggregateType: "payment_order",
            aggregateId: orderId,
            provider: PROVIDER,
            environment,
            result: "SUCCEEDED",
            metadata: { providerOrderId },
            createdAt: now2,
          },
        });

        // Persist checkout URL also on payment order snapshot
        const order = await db.paymentOrders.findById(orderId);
        if (order) {
          await db.paymentOrders.save({
            ...order,
            distributionSnapshot: {
              ...(order.distributionSnapshot ?? {}),
              checkoutUrl,
              idempotencyKey: input.idempotencyKey,
              payloadHash: input.payloadHash,
              attempt,
            },
            updatedAt: now2,
          });
        }
      } catch (error) {
        await db.idempotency.markFailed(reserve.id, now2);
        await db.audit.append({
          id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          actorType: "system",
          action: "clickaton.checkout.provider.failed",
          aggregateType: "payment_order",
          aggregateId: orderId,
          provider: PROVIDER,
          environment,
          result: "FAILED",
          errorCode: "PROVIDER_REGISTER_FAILED",
          metadata: {
            message: error instanceof Error ? error.message.slice(0, 120) : "unknown",
          },
          createdAt: now2,
        });
        throw error;
      }

      const finalOrder = await db.paymentOrders.findById(orderId);
      if (!finalOrder) throw new Error("order_missing_after_create");
      const durable = await buildDurableOrder(db, finalOrder, {
        idempotencyKey: input.idempotencyKey,
        payloadHash: input.payloadHash,
      });
      return { outcome: "created", order: durable };
    },

    async getOrder(orderId: string): Promise<DurableCheckoutOrder | null> {
      const order = await db.paymentOrders.findById(orderId);
      if (!order) return null;
      return buildDurableOrder(db, order);
    },

    async findActiveOrderBySource(sourceId: string): Promise<DurableCheckoutOrder | null> {
      const intent = await db.intents.findByExternalReference(
        SOURCE_PRODUCT,
        externalRefForRegistration(sourceId),
      );
      if (!intent) return null;
      const orders = await db.paymentOrders.listByPaymentIntentId(intent.id);
      for (const o of orders) {
        const durable = await buildDurableOrder(db, o);
        if (isReusableNormalized(durable.status) || durable.status === "APPROVED") {
          return durable;
        }
      }
      return orders[0] ? buildDurableOrder(db, orders[0]) : null;
    },

    async findOrderByIdempotencyKey(
      idempotencyKey: string,
      environment: "sandbox" | "production" = "sandbox",
    ): Promise<DurableCheckoutOrder | null> {
      const record = await db.idempotency.find(PROVIDER, environment, idempotencyKey);
      if (!record?.aggregateId) return null;
      const order = await db.paymentOrders.findById(record.aggregateId);
      if (!order) return null;
      return buildDurableOrder(db, order, {
        idempotencyKey,
        payloadHash: record.payloadHash,
      });
    },

    async refreshOrder(orderId: string): Promise<DurableCheckoutOrder | null> {
      const order = await db.paymentOrders.findById(orderId);
      if (!order) return null;
      const providerOrder = await db.providerOrders.findByPaymentOrderId(orderId);
      const now = new Date().toISOString();
      if (providerOrder) {
        await db.providerOrders.save({
          ...providerOrder,
          lastFetchedAt: now,
          updatedAt: now,
        });
      }
      await db.audit.append({
        id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        actorType: "system",
        action: "clickaton.checkout.refresh",
        aggregateType: "payment_order",
        aggregateId: orderId,
        provider: order.provider,
        environment: order.environment,
        result: "SUCCEEDED",
        createdAt: now,
      });
      return buildDurableOrder(db, order);
    },

    async applyNormalizedEvent(
      event: NormalizedCheckoutEvent,
    ): Promise<ApplyNormalizedCheckoutEventResult> {
      const now = event.receivedAt || new Date().toISOString();
      const order = await db.paymentOrders.findById(event.orderId);
      if (!order) {
        return { outcome: "not_found", order: null, inboxId: null };
      }

      const intent = await db.intents.findById(order.paymentIntentId);
      const expectedSource = intent ? extractSourceId(intent.externalReference) : null;
      if (expectedSource && expectedSource !== event.sourceId) {
        return {
          outcome: "conflict",
          conflictCode: "PAYMENT_CONFLICT",
          order: await buildDurableOrder(db, order),
          inboxId: null,
        };
      }
      if (Number(order.amountMinor) !== event.amountMinor) {
        return {
          outcome: "conflict",
          conflictCode: "PAYMENT_AMOUNT_MISMATCH",
          order: await buildDurableOrder(db, order),
          inboxId: null,
        };
      }
      if (order.currency !== event.currency) {
        return {
          outcome: "conflict",
          conflictCode: "PAYMENT_CURRENCY_MISMATCH",
          order: await buildDurableOrder(db, order),
          inboxId: null,
        };
      }

      const inboxId = `wh_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const rawBodyHash = createHash("sha256")
        .update(JSON.stringify({ eventId: event.eventId, orderId: event.orderId, status: event.status }))
        .digest("hex");

      const ingest = await db.webhooks.ingest({
        id: inboxId,
        provider: PROVIDER,
        environment: order.environment,
        eventType: "clickaton.normalized_payment",
        providerEventId: event.eventId,
        providerResourceId: event.orderId,
        rawBodyHash,
        payloadSanitized: {
          status: event.status,
          amountMinor: event.amountMinor,
          currency: event.currency,
          sourceId: event.sourceId,
        },
        receivedAt: now,
        processingStatus: "RECEIVED",
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      });

      if (ingest.kind === "DUPLICATE") {
        return {
          outcome: "duplicate",
          order: await buildDurableOrder(db, order),
          inboxId: ingest.record.id,
        };
      }

      const activeInboxId = ingest.record.id;
      await db.webhooks.markProcessing(activeInboxId, now);

      try {
        const paymentStatus = mapNormalizedToPaymentOrderStatus(event.status);
        const mappedStatus = mapNormalizedToProviderMappedStatus(event.status);
        const updatedAt = new Date().toISOString();

        await db.paymentOrders.save({
          ...order,
          status: paymentStatus,
          distributionSnapshot: {
            ...(order.distributionSnapshot ?? {}),
            normalizedStatus: event.status,
          },
          updatedAt,
        });

        const providerOrder = await db.providerOrders.findByPaymentOrderId(order.id);
        if (providerOrder) {
          await db.providerOrders.save({
            ...providerOrder,
            providerStatus: event.status.toLowerCase(),
            mappedStatus,
            rawResponseSanitized: {
              ...(providerOrder.rawResponseSanitized ?? {}),
              normalizedStatus: event.status,
            },
            lastFetchedAt: updatedAt,
            updatedAt,
          });
        }

        await db.audit.append({
          id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          actorType: "provider",
          action: "clickaton.checkout.event.applied",
          aggregateType: "payment_order",
          aggregateId: order.id,
          provider: PROVIDER,
          environment: order.environment,
          result: "SUCCEEDED",
          metadata: { eventId: event.eventId, status: event.status },
          createdAt: updatedAt,
        });

        await db.webhooks.markProcessed(activeInboxId, updatedAt);

        const refreshed = await db.paymentOrders.findById(order.id);
        return {
          outcome: "applied",
          order: refreshed ? await buildDurableOrder(db, refreshed) : null,
          inboxId: activeInboxId,
        };
      } catch (error) {
        await db.webhooks.markFailed(
          activeInboxId,
          error instanceof Error ? error.message.slice(0, 80) : "APPLY_FAILED",
          new Date().toISOString(),
        );
        throw error;
      }
    },

    async listOrderEvents(orderId: string) {
      return db.audit.list({ aggregateType: "payment_order", aggregateId: orderId });
    },

    async reconcile(input: {
      registrationId: string;
      registrationStatus: string;
      registrationPaymentStatus: string;
      paymentOrderId: string | null;
      registrationAmountMinor: number;
      registrationCurrency: string;
      capacityHoldActive: boolean;
    }): Promise<ReconcileClickatonCheckoutResult> {
      const findings: string[] = [];
      const actions: string[] = [];

      if (!input.paymentOrderId) {
        if (input.registrationStatus === "CONFIRMED") {
          findings.push("confirmed_without_payment_order");
          return { status: "MANUAL_REVIEW", findings, actions };
        }
        return { status: "CONSISTENT", findings: ["no_order_yet"], actions };
      }

      const order = await db.paymentOrders.findById(input.paymentOrderId);
      if (!order) {
        findings.push("soft_ref_broken_order_missing");
        return { status: "MANUAL_REVIEW", findings, actions };
      }

      const durable = await buildDurableOrder(db, order);

      if (durable.sourceId !== input.registrationId) {
        findings.push("source_mismatch");
      }
      if (durable.amountMinor !== input.registrationAmountMinor) {
        findings.push("amount_mismatch");
      }
      if (durable.currency !== input.registrationCurrency) {
        findings.push("currency_mismatch");
      }

      if (durable.status === "APPROVED" && input.registrationStatus === "PENDING_PAYMENT") {
        findings.push("approved_order_pending_registration");
        actions.push("apply_approved_effect");
      }
      if (
        input.registrationStatus === "CONFIRMED" &&
        durable.status !== "APPROVED"
      ) {
        findings.push("confirmed_without_approved_order");
      }
      if (
        durable.status === "APPROVED" &&
        input.registrationStatus === "CONFIRMED" &&
        !input.capacityHoldActive
      ) {
        // holds consumed is OK after confirm
      }
      if (
        durable.status === "APPROVED" &&
        input.registrationStatus === "PENDING_PAYMENT" &&
        !input.capacityHoldActive
      ) {
        findings.push("approved_with_missing_holds");
      }

      const intent = await db.intents.findById(order.paymentIntentId);
      if (intent) {
        const all = await db.paymentOrders.listByPaymentIntentId(intent.id);
        const approved = [];
        for (const o of all) {
          const d = await buildDurableOrder(db, o);
          if (d.status === "APPROVED") approved.push(d.id);
        }
        if (approved.length > 1) findings.push("multiple_approved_orders");
      }

      if (findings.some((f) => f.includes("mismatch") || f.includes("broken") || f.includes("multiple"))) {
        return { status: "MANUAL_REVIEW", findings, actions };
      }
      if (findings.includes("approved_order_pending_registration")) {
        return { status: "MANUAL_REVIEW", findings, actions };
      }
      if (findings.includes("confirmed_without_approved_order")) {
        return { status: "MANUAL_REVIEW", findings, actions };
      }

      return { status: "CONSISTENT", findings, actions };
    },
  };
}

export type ClickatonCheckoutService = ReturnType<typeof createClickatonCheckoutService>;
