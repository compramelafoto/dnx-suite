import { createHash, randomUUID } from "node:crypto";
import type { DnxPaymentsPersistence } from "../../persistence/ports.js";
import { verifyMercadoPagoWebhookSignature } from "../../../providers/mercado-pago/webhooks/signature.js";
import {
  buildOrdersWebhookEventId,
  parseMercadoPagoOrdersNotification,
} from "../../../providers/mercado-pago/webhooks/orders-notification.js";
import { isOrders1nWebhookObserveEnabled } from "../../../providers/mercado-pago/orders/orders-1n-observe-flag.js";
import {
  associateSnapshot,
  reconcileWebhookAgainstGet,
  toCanonicalOrderView,
} from "./reconcile.js";
import { bumpAlert, createOrdersObserveCounters } from "./observability.js";
import type {
  CanonicalOrderView,
  ExpectedOrdersObserveContext,
  OrdersObserveAlertCode,
  OrdersObserveCounters,
  OrdersObserveResult,
} from "./types.js";

export type FetchCanonicalOrder = (providerOrderId: string) => Promise<{
  providerOrderId: string;
  status: string;
  statusDetail?: string | null;
  externalReference?: string | null;
  totalMinor?: string | null;
  currency?: string | null;
  splitAmounts?: string[];
  paymentCount?: number;
} | null>;

export type ObserveOrdersWebhookInput = {
  headers: Record<string, string | undefined>;
  rawBody: string;
  queryDataId?: string | null;
  queryType?: string | null;
  webhookSecret: string | null | undefined;
  persistence: DnxPaymentsPersistence;
  fetchCanonicalOrder?: FetchCanonicalOrder;
  expected?: ExpectedOrdersObserveContext;
  snapshotRead?: ExpectedOrdersObserveContext["snapshot"] | null;
  /**
   * When true (CLI with confirms), allow observe even if process flag is off
   * for the duration of the controlled run. Runtime HTTP must pass false.
   */
  allowCliBypass?: boolean;
  deliveryClass?: "HTTP_DELIVERED_FROM_MP" | "SIGNED_REPLAY_OF_SANDBOX_ORDER";
  counters?: OrdersObserveCounters;
  environment?: "sandbox" | "production";
};

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function prefix(value: string, n = 10): string {
  return value.length <= n ? `${value.slice(0, 2)}…` : `${value.slice(0, n)}…`;
}

export async function observeOrdersWebhook(
  input: ObserveOrdersWebhookInput,
): Promise<OrdersObserveResult> {
  const counters = input.counters ?? createOrdersObserveCounters();
  counters.received += 1;
  const alerts: OrdersObserveAlertCode[] = [];
  const env = input.environment ?? "sandbox";

  const observeOn =
    isOrders1nWebhookObserveEnabled() || Boolean(input.allowCliBypass);
  if (!observeOn) {
    bumpAlert(counters, "OBSERVE_FLAG_OFF");
    alerts.push("OBSERVE_FLAG_OFF");
    return { ok: false, code: "OBSERVE_FLAG_OFF", alerts };
  }

  const parsed = parseMercadoPagoOrdersNotification({
    rawBody: input.rawBody,
    queryDataId: input.queryDataId,
    queryType: input.queryType,
  });
  if (!parsed.ok) {
    return { ok: false, code: parsed.code, alerts };
  }

  const signatureHeader =
    input.headers["x-signature"] ?? input.headers["X-Signature"];
  const requestIdHeader =
    input.headers["x-request-id"] ?? input.headers["X-Request-Id"];

  const verified = verifyMercadoPagoWebhookSignature({
    signatureHeader,
    requestIdHeader,
    dataId: parsed.notification.dataId,
    secret: input.webhookSecret,
  });
  if (!verified.ok) {
    counters.signatureFail += 1;
    bumpAlert(counters, "SIGNATURE_FAIL");
    alerts.push("SIGNATURE_FAIL");
    await input.persistence.audit.append({
      id: randomUUID(),
      actorType: "provider",
      action: "orders_1n.webhook.signature_fail",
      aggregateType: "provider_order",
      aggregateId: prefix(parsed.notification.dataId),
      provider: "mercadopago",
      environment: env,
      result: "DENIED",
      errorCode: verified.reason,
      metadata: { reason: verified.reason },
      createdAt: new Date().toISOString(),
    });
    return {
      ok: false,
      code:
        verified.reason === "missing_secret"
          ? "WEBHOOK_SECRET_MISSING"
          : "WEBHOOK_INVALID_SIGNATURE",
      alerts,
      detail: verified.reason,
    };
  }
  counters.signatureOk += 1;

  const liveMode = parsed.notification.liveMode;
  if (env === "sandbox" && liveMode === true) {
    counters.liveModeRejected += 1;
    bumpAlert(counters, "LIVE_MODE_FORBIDDEN");
    alerts.push("LIVE_MODE_FORBIDDEN");
    return { ok: false, code: "LIVE_MODE_FORBIDDEN", alerts };
  }
  if (liveMode === null && env === "sandbox") {
    // Require explicit false for TEST observe circuit.
    counters.liveModeRejected += 1;
    bumpAlert(counters, "LIVE_MODE_FORBIDDEN");
    alerts.push("LIVE_MODE_FORBIDDEN");
    return { ok: false, code: "LIVE_MODE_UNDECLARED", alerts };
  }

  const requestId = String(requestIdHeader).slice(0, 80);
  const eventId = buildOrdersWebhookEventId({
    requestId,
    providerOrderId: parsed.notification.dataId,
    action: parsed.notification.action,
  });

  const now = new Date().toISOString();
  const inboxId = randomUUID();
  const ingest = await input.persistence.webhooks.ingest({
    id: inboxId,
    provider: "mercadopago",
    environment: env,
    eventType: parsed.notification.type,
    providerEventId: eventId,
    providerResourceId: parsed.notification.dataId,
    headersHash: hash(`x-signature;x-request-id=${requestId}`),
    rawBodyHash: hash(input.rawBody),
    payloadSanitized: {
      type: parsed.notification.type,
      action: parsed.notification.action,
      orderIdPrefix: prefix(parsed.notification.dataId),
      liveMode,
      apiVersion: parsed.notification.apiVersion,
      userIdPrefix: parsed.notification.userIdPrefix,
    },
    receivedAt: now,
    processingStatus: "RECEIVED",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  });

  if (ingest.kind === "DUPLICATE") {
    counters.duplicates += 1;
    await input.persistence.audit.append({
      id: randomUUID(),
      actorType: "system",
      action: "orders_1n.webhook.duplicate",
      aggregateType: "provider_order",
      aggregateId: prefix(parsed.notification.dataId),
      provider: "mercadopago",
      environment: env,
      correlationId: eventId.slice(0, 64),
      result: "SKIPPED",
      metadata: { inboxId: ingest.record.id },
      createdAt: now,
    });
    return {
      ok: true,
      outcome: "duplicate",
      eventId,
      providerOrderId: parsed.notification.dataId,
      providerOrderIdPrefix: prefix(parsed.notification.dataId),
      liveMode: Boolean(liveMode),
      inboxId: ingest.record.id,
      canonical: null,
      snapshot: null,
      mismatches: [],
      alerts,
      deliveryClass: input.deliveryClass ?? "HTTP_DELIVERED_FROM_MP",
    };
  }

  await input.persistence.webhooks.markProcessing(ingest.record.id, now);

  let canonical: CanonicalOrderView | null = null;
  const mismatches = [];

  if (input.fetchCanonicalOrder) {
    try {
      const fetched = await input.fetchCanonicalOrder(parsed.notification.dataId);
      if (!fetched) {
        bumpAlert(counters, "GET_ORDER_FAILED");
        alerts.push("GET_ORDER_FAILED");
        await input.persistence.webhooks.markFailed(
          ingest.record.id,
          "GET_ORDER_FAILED",
          new Date().toISOString(),
        );
        counters.retries += 1;
        bumpAlert(counters, "RETRY_SCHEDULED");
        alerts.push("RETRY_SCHEDULED");
        return {
          ok: false,
          code: "GET_ORDER_FAILED",
          alerts,
          detail: "canonical_get_returned_null",
        };
      }
      canonical = toCanonicalOrderView(fetched);
      mismatches.push(
        ...reconcileWebhookAgainstGet({
          webhookOrderId: parsed.notification.dataId,
          canonical,
          expected: input.expected,
        }),
      );
    } catch (err) {
      bumpAlert(counters, "GET_ORDER_FAILED");
      alerts.push("GET_ORDER_FAILED");
      await input.persistence.webhooks.markFailed(
        ingest.record.id,
        "GET_ORDER_FAILED",
        new Date().toISOString(),
      );
      counters.retries += 1;
      bumpAlert(counters, "RETRY_SCHEDULED");
      return {
        ok: false,
        code: "GET_ORDER_FAILED",
        alerts,
        detail: err instanceof Error ? err.message.slice(0, 120) : "get_error",
      };
    }
  }

  let snapshot = null;
  if (canonical) {
    const assoc = associateSnapshot({
      canonical,
      expected: input.expected,
      snapshotRead: input.snapshotRead,
    });
    snapshot = assoc.association;
    mismatches.push(...assoc.mismatches);
  }

  if (mismatches.length > 0) {
    counters.mismatches += 1;
    for (const m of mismatches) {
      bumpAlert(counters, m.code);
      if (!alerts.includes(m.code)) alerts.push(m.code);
    }
  }

  const processedAt = new Date().toISOString();
  await input.persistence.webhooks.markProcessed(ingest.record.id, processedAt);
  counters.processed += 1;

  await input.persistence.audit.append({
    id: randomUUID(),
    actorType: "system",
    action: "orders_1n.webhook.processed",
    aggregateType: "provider_order",
    aggregateId: prefix(parsed.notification.dataId),
    provider: "mercadopago",
    environment: env,
    correlationId: eventId.slice(0, 64),
    result: mismatches.length ? "FAILED" : "SUCCEEDED",
    errorCode: mismatches[0]?.code,
    metadata: {
      status: canonical?.status ?? null,
      statusDetail: canonical?.statusDetail ?? null,
      externalReference: canonical?.externalReference ?? null,
      recipientCount: canonical?.recipientCount ?? null,
      snapshotIdPrefix: snapshot?.idPrefix ?? null,
      snapshotIntact: snapshot?.intact ?? null,
      mismatchCount: mismatches.length,
      deliveryClass: input.deliveryClass ?? "HTTP_DELIVERED_FROM_MP",
    },
    createdAt: processedAt,
  });

  return {
    ok: true,
    outcome: "processed",
    eventId,
    providerOrderId: parsed.notification.dataId,
    providerOrderIdPrefix: prefix(parsed.notification.dataId),
    liveMode: Boolean(liveMode),
    inboxId: ingest.record.id,
    canonical,
    snapshot,
    mismatches,
    alerts,
    deliveryClass: input.deliveryClass ?? "HTTP_DELIVERED_FROM_MP",
  };
}

export { createOrdersObserveCounters, summarizeOrdersObserveCounters } from "./observability.js";
export type { OrdersObserveCounters } from "./types.js";
