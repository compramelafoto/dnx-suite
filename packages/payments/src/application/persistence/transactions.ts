import type { DnxPaymentsPersistence } from "./ports";
import type {
  PersistedAuditEvent,
  PersistedIdempotencyRecord,
  PersistedPaymentIntent,
  PersistedPaymentOrder,
  PersistedProviderOrder,
  PersistedProviderSplit,
} from "./types";

/**
 * Transactional boundaries for DNX Payments persistence.
 * HTTP provider calls stay OUTSIDE these units.
 */

export async function createIntentUnit(
  db: DnxPaymentsPersistence,
  input: {
    intent: PersistedPaymentIntent;
    audit: PersistedAuditEvent;
  },
): Promise<void> {
  await db.intents.save(input.intent);
  await db.audit.append(input.audit);
}

export async function reserveIdempotencyUnit(
  db: DnxPaymentsPersistence,
  input: {
    reserve: Parameters<DnxPaymentsPersistence["idempotency"]["reserve"]>[0];
    order: PersistedPaymentOrder;
    audit: PersistedAuditEvent;
  },
): Promise<PersistedIdempotencyRecord> {
  const result = await db.idempotency.reserve(input.reserve);
  if (result.kind === "CONFLICT") {
    await db.audit.append({
      ...input.audit,
      result: "FAILED",
      errorCode: "IDEMPOTENCY_PAYLOAD_CONFLICT",
    });
    return result.record;
  }
  if (result.kind === "CREATED") {
    await db.paymentOrders.save({
      ...input.order,
      idempotencyRecordId: result.record.id,
    });
    await db.audit.append(input.audit);
  }
  return result.record;
}

export async function registerProviderOrderUnit(
  db: DnxPaymentsPersistence,
  input: {
    providerOrder: PersistedProviderOrder;
    splits: PersistedProviderSplit[];
    idempotencyId: string;
    now: string;
    audit: PersistedAuditEvent;
    responseHash?: string;
  },
): Promise<void> {
  await db.providerOrders.save(input.providerOrder);
  await db.providerSplits.saveMany(input.splits);
  await db.idempotency.markSucceeded(input.idempotencyId, {
    now: input.now,
    providerReference: input.providerOrder.providerOrderId,
    ...(input.responseHash ? { responseHash: input.responseHash } : {}),
  });
  await db.audit.append(input.audit);
}

/**
 * Pattern: reserve → commit → call provider → persist result → reconcile if uncertain.
 * This helper only documents the boundary; callers must not wrap HTTP inside DB txs.
 */
export function assertHttpOutsideTransaction(): void {
  // Marker for tests / reviewers. No runtime side effects.
}
