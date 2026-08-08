import { createHash, randomUUID } from "node:crypto";
import type { DnxPaymentsPersistence } from "../../persistence/ports";
import {
  createIntentUnit,
  registerProviderOrderUnit,
} from "../../persistence/transactions";
import type { PersistedPaymentOrder, PersistedProviderOrder } from "../../persistence/types";
import { ensureClickatonPlatformRecipients } from "./ensure-platform-recipients";
import {
  buildSplitsFromEditionPlan,
  ensureRecipientsForEditionPlan,
  planRequiredEditionFinance,
  sanitizeEditionFinanceForOrderSnapshot,
} from "./edition-finance-checkout.js";
import {
  canApplyNormalizedStatusTransition,
  isReusableNormalized,
  isTerminalNormalized,
  mapNormalizedToPaymentOrderStatus,
  mapNormalizedToProviderMappedStatus,
  mapPaymentOrderStatusToNormalized,
} from "./map-status";
import type {
  ApplyNormalizedCheckoutEventResult,
  CheckoutEventOrigin,
  ClickatonCheckoutProviderBridge,
  CreateClickatonCheckoutOrderInput,
  CreateClickatonCheckoutOrderResult,
  DurableCheckoutOrder,
  NormalizedCheckoutEvent,
  NormalizedCheckoutStatus,
  ReconcileClickatonCheckoutResult,
} from "./types";
import type { ProviderName } from "../../../contracts/primitives";
import type { PlannedEditionCheckout } from "../../../edition-checkout/types.js";
import {
  assertLivePaymentsExecutionAllowed,
  isClickatonLivePaymentsEnabled,
  isClickatonProductionRuntime,
} from "./live-payments-flag";

const SOURCE_PRODUCT = "clickaton";
const DEFAULT_CHECKOUT_BASE = "https://payments.test/checkout";

function createManualProviderBridge(): ClickatonCheckoutProviderBridge {
  return {
    mode: "manual",
    providerName: "manual",
    async createCheckout(input) {
      const checkoutBase = (input.checkoutBaseUrl ?? DEFAULT_CHECKOUT_BASE).replace(
        /\/$/,
        "",
      );
      const checkoutToken = createHash("sha256")
        .update(`${input.orderId}:${input.payloadHash}`)
        .digest("hex")
        .slice(0, 24);
      const checkoutUrl = `${checkoutBase}/${input.orderId}?t=${checkoutToken}`;
      return {
        checkoutUrl,
        providerOrderId: `fake_${input.orderId}`,
        rawSanitized: {
          checkoutUrl,
          sourceApp: "CLICKATON",
          sourceType: "REGISTRATION",
          sourceId: input.sourceId,
        },
      };
    },
  };
}

function externalRefForRegistration(
  sourceId: string,
  mode: ClickatonCheckoutProviderBridge["mode"] = "manual",
): string {
  // Mercado Pago Orders rejects ':' in external_reference (property_value pattern).
  // Preferences/manual keep the historical colon form.
  if (mode === "mercado_pago_orders_test") {
    return `clickaton-registration-${sourceId}`;
  }
  return `clickaton:registration:${sourceId}`;
}

function externalRefForStoreOrder(
  publicId: string,
  mode: ClickatonCheckoutProviderBridge["mode"] = "manual",
): string {
  if (mode === "mercado_pago_orders_test") {
    return `CLICKATON_STORE_ORDER-${publicId}`;
  }
  return `CLICKATON_STORE_ORDER:${publicId}`;
}

function externalRefForSource(
  sourceType: "REGISTRATION" | "STORE_ORDER",
  sourceId: string,
  mode: ClickatonCheckoutProviderBridge["mode"] = "manual",
): string {
  if (sourceType === "STORE_ORDER") {
    return externalRefForStoreOrder(sourceId, mode);
  }
  return externalRefForRegistration(sourceId, mode);
}

function extractSourceId(externalReference: string): string {
  const storeColon = "CLICKATON_STORE_ORDER:";
  const storeHyphen = "CLICKATON_STORE_ORDER-";
  if (externalReference.startsWith(storeColon)) {
    return externalReference.slice(storeColon.length);
  }
  if (externalReference.startsWith(storeHyphen)) {
    return externalReference.slice(storeHyphen.length);
  }
  const colonPrefix = "clickaton:registration:";
  const hyphenPrefix = "clickaton-registration-";
  if (externalReference.startsWith(colonPrefix)) {
    return externalReference.slice(colonPrefix.length);
  }
  if (externalReference.startsWith(hyphenPrefix)) {
    return externalReference.slice(hyphenPrefix.length);
  }
  return externalReference;
}

function extractSourceType(
  externalReference: string,
): "REGISTRATION" | "STORE_ORDER" {
  if (
    externalReference.startsWith("CLICKATON_STORE_ORDER:") ||
    externalReference.startsWith("CLICKATON_STORE_ORDER-")
  ) {
    return "STORE_ORDER";
  }
  return "REGISTRATION";
}

export function isClickatonRegistrationExternalRef(ref: string | null | undefined): boolean {
  if (!ref) return false;
  return (
    ref.startsWith("clickaton:registration:") ||
    ref.startsWith("clickaton-registration-")
  );
}

export function isClickatonStoreOrderExternalRef(ref: string | null | undefined): boolean {
  if (!ref) return false;
  return (
    ref.startsWith("CLICKATON_STORE_ORDER:") ||
    ref.startsWith("CLICKATON_STORE_ORDER-")
  );
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

function inferCheckoutEventOrigin(event: NormalizedCheckoutEvent): CheckoutEventOrigin {
  if (event.origin) return event.origin;
  if (event.eventId.startsWith("refresh_")) return "S2S_REFRESH";
  if (event.eventId.startsWith("mp_wh_")) return "HTTP_WEBHOOK";
  if (event.eventId.startsWith("sim_")) return "SIMULATION";
  if (event.eventId.startsWith("recon_")) return "RECONCILIATION";
  return "NORMALIZED";
}

/**
 * Acepta live_mode=true cuando:
 * - attestation sandbox TEST (bridge TEST + orden SANDBOX / fixture), o
 * - LIVE real (bridge mercado_pago_production + orden PRODUCTION).
 * No usa "if staging then ignore".
 */
function isSandboxLiveModeAttested(input: {
  bridgeMode: ClickatonCheckoutProviderBridge["mode"];
  orderEnvironment: string;
  isTestFixture?: boolean;
}): boolean {
  if (input.isTestFixture) return true;
  const env = String(input.orderEnvironment).toUpperCase();
  if (input.bridgeMode === "mercado_pago_production") {
    return env === "PRODUCTION" || env === "PROD" || env === "LIVE";
  }
  const testBridge =
    input.bridgeMode === "mercado_pago_test" ||
    input.bridgeMode === "mercado_pago_orders_test";
  return testBridge && env === "SANDBOX";
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
  const statusDetail =
    typeof snap.statusDetail === "string"
      ? snap.statusDetail
      : typeof providerOrder?.rawResponseSanitized?.statusDetail === "string"
        ? providerOrder.rawResponseSanitized.statusDetail
        : typeof providerOrder?.providerStatus === "string"
          ? providerOrder.providerStatus
          : null;
  const refundedAmountMinor =
    typeof snap.refundedAmountMinor === "number" ? snap.refundedAmountMinor : null;
  const netAmountMinor =
    typeof snap.netAmountMinor === "number" ? snap.netAmountMinor : null;
  const providerPaymentId =
    typeof snap.providerPaymentId === "string"
      ? snap.providerPaymentId
      : typeof providerOrder?.rawResponseSanitized?.providerPaymentId === "string"
        ? providerOrder.rawResponseSanitized.providerPaymentId
        : null;
  const providerRefundIds = Array.isArray(snap.providerRefundIds)
    ? snap.providerRefundIds.map(String)
    : [];

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
    sourceType: intent
      ? extractSourceType(intent.externalReference)
      : "REGISTRATION",
    sourceId: intent ? extractSourceId(intent.externalReference) : "unknown",
    idempotencyKey,
    payloadHash,
    attempt,
    providerOrderId: providerOrder?.providerOrderId ?? null,
    statusDetail,
    refundedAmountMinor,
    netAmountMinor,
    providerPaymentId,
    providerRefundIds,
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

function isCompleteReusableOrder(order: DurableCheckoutOrder): boolean {
  return isReusableNormalized(order.status) && Boolean(order.checkoutUrl);
}

async function waitForCheckoutUrl(
  db: DnxPaymentsPersistence,
  orderId: string,
  opts: { idempotencyKey: string; payloadHash: string },
  attempts = 25,
): Promise<DurableCheckoutOrder | null> {
  for (let i = 0; i < attempts; i++) {
    const order = await db.paymentOrders.findById(orderId);
    if (!order) return null;
    const durable = await buildDurableOrder(db, order, opts);
    if (durable.checkoutUrl) return durable;
    await new Promise((r) => setTimeout(r, 20));
  }
  const order = await db.paymentOrders.findById(orderId);
  return order ? buildDurableOrder(db, order, opts) : null;
}

export type ClickatonOperationalSnapshotHook = (input: {
  totalMinor: bigint;
  externalReference: string;
  paymentIntentId: string;
  paymentOrderId: string;
}) => Promise<{
  snapshotId: string;
  snapshotIdPrefix: string;
  hashPrefix: string;
  bps: number[];
  compatibleJson: Record<string, unknown>;
}>;

export function createClickatonCheckoutService(
  db: DnxPaymentsPersistence,
  opts?: {
    providerBridge?: ClickatonCheckoutProviderBridge;
    /** Staging Orders path: append-only operational snapshot (never mutates E). */
    buildOperationalSnapshot?: ClickatonOperationalSnapshotHook;
  },
) {
  const bridge = opts?.providerBridge ?? createManualProviderBridge();
  const PROVIDER: ProviderName = bridge.providerName;

  return {
    providerMode: bridge.mode,
    providerName: PROVIDER,

    async createOrder(
      input: CreateClickatonCheckoutOrderInput,
    ): Promise<CreateClickatonCheckoutOrderResult> {
      const environment = input.environment ?? "sandbox";
      const liveGate = assertLivePaymentsExecutionAllowed({
        bridgeMode: bridge.mode,
        environment,
        liveFlagEnabled: isClickatonLivePaymentsEnabled(),
        productionRuntime: isClickatonProductionRuntime(),
      });
      if (!liveGate.ok) {
        throw new Error(liveGate.reason);
      }
      // Legacy hard-block for accidental production env without LIVE bridge.
      if (environment === "production" && bridge.mode !== "mercado_pago_production") {
        throw new Error("clickaton_checkout_production_forbidden");
      }
      const now = new Date().toISOString();
      const externalReference = externalRefForSource(
        input.sourceType,
        input.sourceId,
        bridge.mode,
      );

      // Etapa 6: snapshot financiero obligatorio para Mercado Pago (no stub owner).
      let editionPlan: PlannedEditionCheckout | null = null;
      let ownerRecipientId: string;
      let partnerRecipientId: string | null = null;
      let editionRecipientIds: string[] = [];
      if (input.editionFinance) {
        editionPlan = planRequiredEditionFinance({
          snapshot: input.editionFinance.snapshot,
          bridgeMode: bridge.mode,
          collectorAccessToken: input.editionFinance.collectorAccessToken,
        });
        const recipients = await ensureRecipientsForEditionPlan(db, editionPlan);
        ownerRecipientId = recipients.ownerRecipientId;
        editionRecipientIds = recipients.recipientIds;
      } else if (bridge.mode !== "manual") {
        throw new Error(
          "edition_finance_snapshot_required: checkout MP debe usar financialDistributionSnapshot",
        );
      } else {
        const stub = await ensureClickatonPlatformRecipients(db);
        ownerRecipientId = stub.ownerRecipientId;
        partnerRecipientId = stub.partnerRecipientId;
      }

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
          const durable = await waitForCheckoutUrl(db, existingIdempo.aggregateId, {
            idempotencyKey: input.idempotencyKey,
            payloadHash: input.payloadHash,
          });
          if (durable && isCompleteReusableOrder(durable)) {
            return { outcome: "reused", order: durable };
          }
          if (durable?.checkoutUrl) {
            return { outcome: "reused", order: durable };
          }
          // Orden incompleta (carrera): no devolver URL null; continuar solo si no hay orden.
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
            if (!durable.checkoutUrl) {
              const waited = await waitForCheckoutUrl(db, o.id, {
                idempotencyKey: input.idempotencyKey,
                payloadHash: input.payloadHash,
              });
              if (waited?.checkoutUrl) {
                return { outcome: "reused", order: waited };
              }
              // incompleta: dejar que el creador original termine; reintentar wait
              const again = await waitForCheckoutUrl(db, o.id, {
                idempotencyKey: input.idempotencyKey,
                payloadHash: input.payloadHash,
              });
              if (again?.checkoutUrl) return { outcome: "reused", order: again };
              continue;
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
          const durable = await waitForCheckoutUrl(db, existingId, {
            idempotencyKey: input.idempotencyKey,
            payloadHash: input.payloadHash,
          });
          if (durable?.checkoutUrl) {
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
          ...(editionPlan
            ? { editionFinance: sanitizeEditionFinanceForOrderSnapshot(editionPlan) }
            : { legacyStubRecipients: true }),
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

      // Provider call (manual fake or Mercado Pago Checkout Pro TEST)
      const now2 = new Date().toISOString();
      let checkoutUrl: string;
      let providerOrderId: string;
      let rawSanitized: Record<string, unknown>;
      try {
        const created = await bridge.createCheckout({
          orderId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          description: input.description,
          externalReference,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          payerEmail: input.payerEmail,
          successUrl: input.successUrl,
          pendingUrl: input.pendingUrl,
          failureUrl: input.failureUrl,
          notificationUrl: input.notificationUrl,
          checkoutBaseUrl: input.checkoutBaseUrl,
          sourceId: input.sourceId,
          ...(input.cardPayment ? { cardPayment: input.cardPayment } : {}),
          ...(editionPlan && input.editionFinance?.collectorAccessToken
            ? {
                collectorAccessToken: input.editionFinance.collectorAccessToken,
                collectorPaymentAccountId: editionPlan.collectorPaymentAccountId,
                editionFinanceModality: editionPlan.modality,
              }
            : {}),
        });
        checkoutUrl = created.checkoutUrl;
        providerOrderId = created.providerOrderId;
        rawSanitized = {
          ...created.rawSanitized,
          checkoutUrl: created.checkoutUrl,
          sourceApp: "CLICKATON",
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          ...(created.immediateStatus
            ? { immediateStatus: created.immediateStatus }
            : {}),
          ...(created.statusDetail ? { statusDetail: created.statusDetail } : {}),
        };
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
          errorCode: "PROVIDER_CREATE_FAILED",
          metadata: {
            message: error instanceof Error ? error.message.slice(0, 120) : "unknown",
          },
          createdAt: now2,
        });
        throw error;
      }

      const providerRowId = `dnx_po_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const immediateNormalized =
        typeof rawSanitized.immediateStatus === "string"
          ? (rawSanitized.immediateStatus as NormalizedCheckoutStatus)
          : undefined;
      const immediateMapped = immediateNormalized
        ? mapNormalizedToProviderMappedStatus(immediateNormalized)
        : "OPEN";
      const immediatePaymentStatus = immediateNormalized
        ? mapNormalizedToPaymentOrderStatus(immediateNormalized)
        : undefined;

      try {
        await registerProviderOrderUnit(db, {
          providerOrder: {
            id: providerRowId,
            paymentOrderId: orderId,
            provider: PROVIDER,
            environment,
            providerOrderId,
            providerStatus:
              typeof rawSanitized.statusDetail === "string"
                ? rawSanitized.statusDetail
                : "created",
            mappedStatus: immediateMapped === "UNKNOWN" ? "OPEN" : immediateMapped,
            totalMinor: BigInt(input.amountMinor),
            currency: input.currency,
            rawResponseSanitized: rawSanitized,
            lastFetchedAt: now2,
            createdAt: now2,
            updatedAt: now2,
          },
          splits: editionPlan
            ? buildSplitsFromEditionPlan({
                providerOrderId: providerRowId,
                planned: editionPlan,
                currency: input.currency,
                now: now2,
                recipientIds: editionRecipientIds,
              })
            : [
                {
                  id: `split_own_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
                  providerOrderId: providerRowId,
                  recipientId: ownerRecipientId,
                  providerReceiverReference: "clickaton-owner",
                  receiverType: "OWNER" as const,
                  amountMinor: BigInt(input.amountMinor),
                  currency: input.currency,
                  status: "PLANNED" as const,
                  createdAt: now2,
                  updatedAt: now2,
                },
                {
                  id: `split_par_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
                  providerOrderId: providerRowId,
                  recipientId: partnerRecipientId!,
                  providerReceiverReference: "clickaton-partner-stub",
                  receiverType: "PARTNER" as const,
                  amountMinor: 0n,
                  currency: input.currency,
                  description: "stub-no-split",
                  status: "PLANNED" as const,
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
          let economicSnap: Record<string, unknown> | undefined;
          if (
            opts?.buildOperationalSnapshot &&
            bridge.mode === "mercado_pago_orders_test"
          ) {
            try {
              const snap = await opts.buildOperationalSnapshot({
                totalMinor: BigInt(input.amountMinor),
                externalReference,
                paymentIntentId: intent.id,
                paymentOrderId: orderId,
              });
              economicSnap = {
                operationalSnapshotIdPrefix: snap.snapshotIdPrefix,
                operationalHashPrefix: snap.hashPrefix,
                operationalBps: snap.bps,
                agreementScope: "partners-10d3i-e",
                stage: "10D3I-H",
              };
            } catch (err) {
              await db.audit.append({
                id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
                actorType: "system",
                action: "clickaton.checkout.snapshot.failed",
                aggregateType: "payment_order",
                aggregateId: orderId,
                provider: PROVIDER,
                environment,
                result: "FAILED",
                errorCode: "OPERATIONAL_SNAPSHOT_FAILED",
                metadata: {
                  message:
                    err instanceof Error ? err.message.slice(0, 120) : "unknown",
                },
                createdAt: now2,
              });
              throw err;
            }
          }
          await db.paymentOrders.save({
            ...order,
            ...(immediatePaymentStatus ? { status: immediatePaymentStatus } : {}),
            distributionSnapshot: {
              ...(order.distributionSnapshot ?? {}),
              checkoutUrl,
              idempotencyKey: input.idempotencyKey,
              payloadHash: input.payloadHash,
              attempt,
              ...(immediateNormalized
                ? { normalizedStatus: immediateNormalized }
                : {}),
              ...(typeof rawSanitized.statusDetail === "string"
                ? { statusDetail: rawSanitized.statusDetail }
                : {}),
              ...(economicSnap ?? {}),
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
      // Incluye REGISTRATION y STORE_ORDER (TIENDA). Sin store refs el webhook
      // MP APPROVED devolvía not_found y nunca capturaba stock.
      const refs = [
        externalRefForRegistration(sourceId, bridge.mode),
        externalRefForRegistration(sourceId, "manual"),
        externalRefForRegistration(sourceId, "mercado_pago_orders_test"),
        externalRefForStoreOrder(sourceId, bridge.mode),
        externalRefForStoreOrder(sourceId, "manual"),
        externalRefForStoreOrder(sourceId, "mercado_pago_orders_test"),
      ];
      const uniqueRefs = [...new Set(refs)];
      for (const externalReference of uniqueRefs) {
        const intent = await db.intents.findByExternalReference(
          SOURCE_PRODUCT,
          externalReference,
        );
        if (!intent) continue;
        const orders = await db.paymentOrders.listByPaymentIntentId(intent.id);
        for (const o of orders) {
          const durable = await buildDurableOrder(db, o);
          if (isReusableNormalized(durable.status) || durable.status === "APPROVED") {
            return durable;
          }
        }
        if (orders[0]) return buildDurableOrder(db, orders[0]);
      }
      return null;
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
      const intent = await db.intents.findById(order.paymentIntentId);
      const now = new Date().toISOString();

      if (bridge.refreshCheckout && providerOrder && intent) {
        const refreshed = await bridge.refreshCheckout({
          providerOrderId: providerOrder.providerOrderId,
          externalReference: intent.externalReference,
          expectedAmountMinor: Number(order.amountMinor),
          expectedCurrency: order.currency,
        });
        if (refreshed) {
          // Mercado Pago puede reportar live_mode=true en Checkout Pro con usuarios TEST.
          // Solo se acepta con attestation sandbox (bridge TEST + orden SANDBOX / fixture).
          const attested = isSandboxLiveModeAttested({
            bridgeMode: bridge.mode,
            orderEnvironment: order.environment,
            isTestFixture: order.isTestFixture,
          });
          const liveModeBlocked = refreshed.liveMode && !attested;
          if (liveModeBlocked) {
            await db.audit.append({
              id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
              actorType: "system",
              action: "clickaton.checkout.refresh.blocked_live_mode_unattested",
              aggregateType: "payment_order",
              aggregateId: orderId,
              provider: order.provider,
              environment: order.environment,
              result: "FAILED",
              errorCode: "LIVE_MODE_FORBIDDEN",
              metadata: {
                bridgeMode: bridge.mode,
                orderEnvironment: order.environment,
                liveModeReported: true,
              },
              createdAt: now,
            });
            return buildDurableOrder(db, order);
          }
          if (refreshed.liveMode && attested) {
            await db.audit.append({
              id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
              actorType: "system",
              action: "clickaton.checkout.refresh.live_mode_attested_sandbox",
              aggregateType: "payment_order",
              aggregateId: orderId,
              provider: order.provider,
              environment: order.environment,
              result: "SUCCEEDED",
              metadata: {
                status: refreshed.status,
                bridgeMode: bridge.mode,
                liveModeReported: true,
                attestation: "mercado_pago_test_sandbox_order",
              },
              createdAt: now,
            });
          }

          // Releer: un APPROVED previo no debe pisarse con PENDING stale de preferencia.
          const latestBeforeApply = await db.paymentOrders.findById(orderId);
          if (latestBeforeApply) {
            const latestNorm = mapPaymentOrderStatusToNormalized(latestBeforeApply.status);
            if (
              isTerminalNormalized(latestNorm) &&
              !isTerminalNormalized(refreshed.status)
            ) {
              await db.audit.append({
                id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
                actorType: "system",
                action: "clickaton.checkout.refresh.ignored_non_terminal_after_terminal",
                aggregateType: "payment_order",
                aggregateId: orderId,
                provider: order.provider,
                environment: order.environment,
                result: "SUCCEEDED",
                metadata: {
                  currentStatus: latestNorm,
                  ignoredStatus: refreshed.status,
                  bridgeMode: bridge.mode,
                },
                createdAt: now,
              });
              return buildDurableOrder(db, latestBeforeApply);
            }
          }

          await db.providerOrders.save({
            ...providerOrder,
            providerStatus: refreshed.status.toLowerCase(),
            mappedStatus:
              refreshed.status === "APPROVED"
                ? "PROCESSED"
                : refreshed.status === "REJECTED" || refreshed.status === "CANCELLED"
                  ? "CANCELED"
                  : "OPEN",
            rawResponseSanitized: {
              ...(providerOrder.rawResponseSanitized ?? {}),
              ...refreshed.rawSanitized,
              normalizedStatus: refreshed.status,
              liveModeReported: refreshed.liveMode,
            },
            lastFetchedAt: now,
            updatedAt: now,
          });
          await this.applyNormalizedEvent({
            eventId: `refresh_${orderId}_${now}`,
            orderId,
            status: refreshed.status,
            amountMinor: refreshed.amountMinor,
            currency: refreshed.currency,
            provider: order.provider,
            externalReference:
              refreshed.externalReference ?? intent.externalReference,
            sourceId: extractSourceId(intent.externalReference),
            receivedAt: now,
            origin: "S2S_REFRESH",
            liveModeReported: refreshed.liveMode,
          });
          const updated = await db.paymentOrders.findById(orderId);
          return updated ? buildDurableOrder(db, updated) : null;
        }
      }

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
      const origin = inferCheckoutEventOrigin(event);
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
          origin,
          liveModeReported: event.liveModeReported ?? null,
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
      const currentNormalized = mapPaymentOrderStatusToNormalized(order.status);
      // No regresar un terminal (p.ej. APPROVED→PENDING / REFUNDED→APPROVED).
      if (!canApplyNormalizedStatusTransition(currentNormalized, event.status)) {
        const updatedAt = new Date().toISOString();
        await db.audit.append({
          id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          actorType: "system",
          action: "clickaton.checkout.event.ignored_status_regression",
          aggregateType: "payment_order",
          aggregateId: order.id,
          provider: PROVIDER,
          environment: order.environment,
          result: "SUCCEEDED",
          metadata: {
            eventId: event.eventId,
            currentStatus: currentNormalized,
            ignoredStatus: event.status,
            refundedAmountMinor: event.refundedAmountMinor ?? null,
          },
          createdAt: updatedAt,
        });
        await db.webhooks.markProcessed(activeInboxId, updatedAt);
        return {
          outcome: "duplicate",
          order: await buildDurableOrder(db, order),
          inboxId: activeInboxId,
        };
      }

      const paymentStatus = mapNormalizedToPaymentOrderStatus(event.status);
      const mappedStatus = mapNormalizedToProviderMappedStatus(event.status);
      const updatedAt = new Date().toISOString();

      await db.paymentOrders.save({
        ...order,
        status: paymentStatus,
        distributionSnapshot: {
          ...(order.distributionSnapshot ?? {}),
          normalizedStatus: event.status,
          ...(typeof event.refundedAmountMinor === "number"
            ? {
                refundedAmountMinor: event.refundedAmountMinor,
                netAmountMinor: event.netAmountMinor ?? null,
                providerPaymentId: event.providerPaymentId ?? null,
                providerRefundIds: event.providerRefundIds ?? [],
                statusDetail: event.statusDetail ?? null,
              }
            : {}),
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
          metadata: {
            eventId: event.eventId,
            status: event.status,
            previousStatus: currentNormalized,
            refundedAmountMinor: event.refundedAmountMinor ?? null,
            netAmountMinor: event.netAmountMinor ?? null,
            providerPaymentId: event.providerPaymentId ?? null,
            providerRefundIds: event.providerRefundIds ?? [],
            idempotencyKey: `${order.id}:${event.status}:${event.refundedAmountMinor ?? 0}`,
          },
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

    /**
     * Lectura S2S del pago (sin mutar estado). Para dry-run / herramientas ops.
     */
    async peekProviderPayment(providerPaymentId: string): Promise<{
      status: NormalizedCheckoutStatus;
      amountMinor: number;
      currency: string;
      externalReference: string | null;
      liveMode: boolean;
      providerPaymentId: string;
      refundedAmountMinor?: number;
      netAmountMinor?: number;
      providerRefundIds?: string[];
      statusDetail?: string | null;
      rawSanitized: Record<string, unknown>;
    } | null> {
      if (!bridge.fetchPaymentById) return null;
      if (!/^\d+$/.test(providerPaymentId)) return null;
      return bridge.fetchPaymentById(providerPaymentId);
    },

    /**
     * Webhook HTTP firmado → S2S getPayment → applyNormalizedEvent (origin HTTP_WEBHOOK).
     */
    async applyProviderPaymentNotification(input: {
      providerPaymentId: string;
      eventId: string;
      liveModeReported?: boolean | null;
      action?: string | null;
    }): Promise<ApplyNormalizedCheckoutEventResult> {
      if (!bridge.fetchPaymentById) {
        return { outcome: "not_found", order: null, inboxId: null };
      }
      const payment = await bridge.fetchPaymentById(input.providerPaymentId);
      if (!payment?.externalReference) {
        return { outcome: "not_found", order: null, inboxId: null };
      }
      const sourceId = extractSourceId(payment.externalReference);
      const order = await this.findActiveOrderBySource(sourceId);
      if (!order) {
        return { outcome: "not_found", order: null, inboxId: null };
      }

      const durable = await db.paymentOrders.findById(order.id);
      if (!durable) {
        return { outcome: "not_found", order: null, inboxId: null };
      }

      const attested = isSandboxLiveModeAttested({
        bridgeMode: bridge.mode,
        orderEnvironment: durable.environment,
        isTestFixture: durable.isTestFixture,
      });
      const liveMode = payment.liveMode;
      if (liveMode && !attested) {
        const now = new Date().toISOString();
        await db.audit.append({
          id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          actorType: "system",
          action: "clickaton.checkout.webhook.blocked_live_mode_unattested",
          aggregateType: "payment_order",
          aggregateId: order.id,
          provider: durable.provider,
          environment: durable.environment,
          result: "FAILED",
          errorCode: "LIVE_MODE_FORBIDDEN",
          metadata: {
            bridgeMode: bridge.mode,
            providerPaymentIdMasked: `${input.providerPaymentId.slice(0, 4)}…`,
            action: input.action ?? null,
          },
          createdAt: now,
        });
        return {
          outcome: "conflict",
          conflictCode: "LIVE_MODE_FORBIDDEN",
          order: await buildDurableOrder(db, durable),
          inboxId: null,
        };
      }

      const providerOrder = await db.providerOrders.findByPaymentOrderId(order.id);
      const now = new Date().toISOString();
      if (providerOrder) {
        await db.providerOrders.save({
          ...providerOrder,
          providerStatus: payment.status.toLowerCase(),
          mappedStatus:
            payment.status === "APPROVED"
              ? "PROCESSED"
              : payment.status === "REJECTED" || payment.status === "CANCELLED"
                ? "CANCELED"
                : "OPEN",
          rawResponseSanitized: {
            ...(providerOrder.rawResponseSanitized ?? {}),
            ...payment.rawSanitized,
            normalizedStatus: payment.status,
            liveModeReported: liveMode,
            webhookAction: input.action ?? null,
            providerPaymentId: input.providerPaymentId,
          },
          lastFetchedAt: now,
          updatedAt: now,
        });
      }

      if (liveMode && attested) {
        await db.audit.append({
          id: `aud_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          actorType: "system",
          action: "clickaton.checkout.webhook.live_mode_attested_sandbox",
          aggregateType: "payment_order",
          aggregateId: order.id,
          provider: durable.provider,
          environment: durable.environment,
          result: "SUCCEEDED",
          metadata: {
            status: payment.status,
            bridgeMode: bridge.mode,
            attestation: "mercado_pago_test_sandbox_order",
          },
          createdAt: now,
        });
      }

      return this.applyNormalizedEvent({
        eventId: input.eventId,
        orderId: order.id,
        status: payment.status,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        provider: durable.provider,
        externalReference: payment.externalReference ?? order.externalReference,
        sourceId,
        receivedAt: now,
        origin: "HTTP_WEBHOOK",
        liveModeReported: liveMode,
        refundedAmountMinor: payment.refundedAmountMinor,
        netAmountMinor: payment.netAmountMinor,
        providerPaymentId: payment.providerPaymentId,
        providerRefundIds: payment.providerRefundIds,
        statusDetail: payment.statusDetail,
      });
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
