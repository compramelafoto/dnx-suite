import type { PaymentEnvironment, ProviderName } from "../../contracts/primitives.js";
import type { DnxPaymentsPersistence } from "./ports.js";
import type {
  IdempotencyReserveResult,
  PersistedAuditEvent,
  PersistedIdempotencyRecord,
  PersistedPaymentIntent,
  PersistedPaymentOrder,
  PersistedPaymentRecipient,
  PersistedProviderOrder,
  PersistedProviderRecipientAccount,
  PersistedProviderSplit,
  PersistedSplitConsent,
  PersistedWebhookInbox,
  WebhookIngestResult,
} from "./types.js";

export class PersistenceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceConflictError";
  }
}

export class ImmutableSplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImmutableSplitError";
  }
}

function accountKey(
  recipientId: string,
  provider: ProviderName,
  environment: PaymentEnvironment,
  ref: string,
): string {
  return `${recipientId}|${provider}|${environment}|${ref}`;
}

function consentKey(
  provider: ProviderName,
  environment: PaymentEnvironment,
  receiverId: string,
): string {
  return `${provider}|${environment}|${receiverId}`;
}

function intentKey(sourceProduct: string, externalReference: string): string {
  return `${sourceProduct}|${externalReference}`;
}

function providerOrderKey(
  provider: ProviderName,
  environment: PaymentEnvironment,
  providerOrderId: string,
): string {
  return `${provider}|${environment}|${providerOrderId}`;
}

function idempotencyKey(
  provider: ProviderName,
  environment: PaymentEnvironment,
  key: string,
): string {
  return `${provider}|${environment}|${key}`;
}

function webhookKey(
  provider: ProviderName,
  environment: PaymentEnvironment,
  eventId: string | null,
  resourceId: string | null,
): string {
  return `${provider}|${environment}|${eventId ?? ""}|${resourceId ?? ""}`;
}

function splitKey(
  providerOrderId: string,
  receiverType: string,
  ref: string,
): string {
  return `${providerOrderId}|${receiverType}|${ref}`;
}

const SENSITIVE = /token|authorization|password|cvv|pan|device.?id|access.?token/i;

export function sanitizeMetadata(
  input?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE.test(k)) {
      out[k] = "[REDACTED]";
      continue;
    }
    if (typeof v === "string" && (v.startsWith("TEST-") || v.startsWith("APP_USR-"))) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function createInMemoryDnxPaymentsPersistence(): DnxPaymentsPersistence {
  const recipients = new Map<string, PersistedPaymentRecipient>();
  const accounts = new Map<string, PersistedProviderRecipientAccount>();
  const accountsByUnique = new Map<string, string>();
  const consents = new Map<string, PersistedSplitConsent>();
  const consentsByReceiver = new Map<string, string>();
  const intents = new Map<string, PersistedPaymentIntent>();
  const intentsByExternal = new Map<string, string>();
  const paymentOrders = new Map<string, PersistedPaymentOrder>();
  const providerOrders = new Map<string, PersistedProviderOrder>();
  const providerOrdersByUnique = new Map<string, string>();
  const splits = new Map<string, PersistedProviderSplit[]>();
  const splitUniques = new Set<string>();
  const idempotency = new Map<string, PersistedIdempotencyRecord>();
  const webhooks = new Map<string, PersistedWebhookInbox>();
  const webhooksByUnique = new Map<string, string>();
  const audit: PersistedAuditEvent[] = [];

  return {
    recipients: {
      async save(recipient) {
        recipients.set(recipient.id, recipient);
      },
      async findById(id) {
        return recipients.get(id) ?? null;
      },
      async list() {
        return [...recipients.values()];
      },
    },
    providerAccounts: {
      async save(account) {
        const key = accountKey(
          account.recipientId,
          account.provider,
          account.environment,
          account.providerAccountReference,
        );
        const existingId = accountsByUnique.get(key);
        if (existingId && existingId !== account.id) {
          throw new PersistenceConflictError("provider recipient account unique conflict");
        }
        accounts.set(account.id, {
          ...account,
          metadataSanitized: sanitizeMetadata(account.metadataSanitized),
        });
        accountsByUnique.set(key, account.id);
      },
      async findById(id) {
        return accounts.get(id) ?? null;
      },
      async findByReference(provider, environment, providerAccountReference) {
        for (const account of accounts.values()) {
          if (
            account.provider === provider &&
            account.environment === environment &&
            account.providerAccountReference === providerAccountReference
          ) {
            return account;
          }
        }
        return null;
      },
    },
    consents: {
      async save(consent) {
        if (consent.environment !== "sandbox" && consent.environment !== "production") {
          throw new PersistenceConflictError("invalid consent environment");
        }
        if (consent.providerReceiverId) {
          const key = consentKey(consent.provider, consent.environment, consent.providerReceiverId);
          const existingId = consentsByReceiver.get(key);
          if (existingId && existingId !== consent.id) {
            throw new PersistenceConflictError("split consent unique conflict");
          }
          consentsByReceiver.set(key, consent.id);
        }
        consents.set(consent.id, consent);
      },
      async findById(id) {
        return consents.get(id) ?? null;
      },
      async findByReceiverId(provider, environment, providerReceiverId) {
        const id = consentsByReceiver.get(consentKey(provider, environment, providerReceiverId));
        return id ? (consents.get(id) ?? null) : null;
      },
      async listActive(environment) {
        return [...consents.values()].filter(
          (c) => c.environment === environment && c.status === "ACTIVE",
        );
      },
    },
    intents: {
      async save(intent) {
        const key = intentKey(String(intent.sourceProduct), intent.externalReference);
        const existingId = intentsByExternal.get(key);
        if (existingId && existingId !== intent.id) {
          throw new PersistenceConflictError("payment intent external reference conflict");
        }
        intents.set(intent.id, intent);
        intentsByExternal.set(key, intent.id);
      },
      async findById(id) {
        return intents.get(id) ?? null;
      },
      async findByExternalReference(sourceProduct, externalReference) {
        const id = intentsByExternal.get(intentKey(sourceProduct, externalReference));
        return id ? (intents.get(id) ?? null) : null;
      },
    },
    paymentOrders: {
      async save(order) {
        paymentOrders.set(order.id, order);
      },
      async findById(id) {
        return paymentOrders.get(id) ?? null;
      },
    },
    providerOrders: {
      async save(order) {
        const key = providerOrderKey(order.provider, order.environment, order.providerOrderId);
        const existingId = providerOrdersByUnique.get(key);
        if (existingId && existingId !== order.id) {
          throw new PersistenceConflictError("provider order unique conflict");
        }
        providerOrders.set(order.id, order);
        providerOrdersByUnique.set(key, order.id);
      },
      async findByProviderOrderId(provider, environment, providerOrderId) {
        const id = providerOrdersByUnique.get(
          providerOrderKey(provider, environment, providerOrderId),
        );
        return id ? (providerOrders.get(id) ?? null) : null;
      },
      async findById(id) {
        return providerOrders.get(id) ?? null;
      },
    },
    providerSplits: {
      async saveMany(nextSplits) {
        if (nextSplits.length === 0) return;
        const providerOrderId = nextSplits[0]!.providerOrderId;
        if (splits.has(providerOrderId)) {
          throw new ImmutableSplitError("provider splits are immutable after create");
        }
        const owners = nextSplits.filter((s) => s.receiverType === "OWNER");
        if (owners.length !== 1) {
          throw new PersistenceConflictError("exactly one OWNER split required");
        }
        if (!nextSplits.some((s) => s.receiverType === "PARTNER")) {
          throw new PersistenceConflictError("at least one PARTNER split required");
        }
        for (const split of nextSplits) {
          const key = splitKey(split.providerOrderId, split.receiverType, split.providerReceiverReference);
          if (splitUniques.has(key)) {
            throw new PersistenceConflictError("provider split unique conflict");
          }
          splitUniques.add(key);
        }
        splits.set(providerOrderId, [...nextSplits]);
      },
      async listByProviderOrderId(providerOrderId) {
        return splits.get(providerOrderId) ?? [];
      },
    },
    idempotency: {
      async reserve(input) {
        const key = idempotencyKey(input.provider, input.environment, input.idempotencyKey);
        const existing = idempotency.get(key);
        if (existing) {
          if (existing.payloadHash === input.payloadHash) {
            return { kind: "SAME_PAYLOAD", record: existing } satisfies IdempotencyReserveResult;
          }
          const conflict: PersistedIdempotencyRecord = {
            ...existing,
            status: "CONFLICT",
            updatedAt: input.now,
          };
          idempotency.set(key, conflict);
          return { kind: "CONFLICT", record: conflict };
        }
        const record: PersistedIdempotencyRecord = {
          id: input.id,
          operation: input.operation,
          provider: input.provider,
          environment: input.environment,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          status: "PROCESSING",
          lockedAt: input.now,
          createdAt: input.now,
          updatedAt: input.now,
          ...(input.aggregateType ? { aggregateType: input.aggregateType } : {}),
          ...(input.aggregateId ? { aggregateId: input.aggregateId } : {}),
        };
        idempotency.set(key, record);
        return { kind: "CREATED", record };
      },
      async markSucceeded(id, input) {
        for (const [key, record] of idempotency.entries()) {
          if (record.id !== id) continue;
          idempotency.set(key, {
            ...record,
            status: "SUCCEEDED",
            succeededAt: input.now,
            updatedAt: input.now,
            ...(input.providerReference ? { providerReference: input.providerReference } : {}),
            ...(input.responseHash ? { responseHash: input.responseHash } : {}),
          });
        }
      },
      async markFailed(id, now) {
        for (const [key, record] of idempotency.entries()) {
          if (record.id !== id) continue;
          idempotency.set(key, {
            ...record,
            status: "FAILED",
            failedAt: now,
            updatedAt: now,
          });
        }
      },
      async find(provider, environment, key) {
        return idempotency.get(idempotencyKey(provider, environment, key)) ?? null;
      },
    },
    webhooks: {
      async ingest(record): Promise<WebhookIngestResult> {
        const key = webhookKey(
          record.provider,
          record.environment,
          record.providerEventId,
          record.providerResourceId,
        );
        const existingId = webhooksByUnique.get(key);
        if (existingId) {
          return { kind: "DUPLICATE", record: webhooks.get(existingId)! };
        }
        const sanitized: PersistedWebhookInbox = {
          ...record,
          payloadSanitized: sanitizeMetadata(record.payloadSanitized),
        };
        webhooks.set(record.id, sanitized);
        webhooksByUnique.set(key, record.id);
        return { kind: "INSERTED", record: sanitized };
      },
      async markProcessing(id, now) {
        const current = webhooks.get(id);
        if (!current) return;
        webhooks.set(id, {
          ...current,
          processingStatus: "PROCESSING",
          attempts: current.attempts + 1,
          updatedAt: now,
        });
      },
      async markProcessed(id, now) {
        const current = webhooks.get(id);
        if (!current) return;
        webhooks.set(id, {
          ...current,
          processingStatus: "PROCESSED",
          processedAt: now,
          updatedAt: now,
        });
      },
      async markFailed(id, errorCodeSanitized, now) {
        const current = webhooks.get(id);
        if (!current) return;
        const dead = current.attempts >= 5;
        webhooks.set(id, {
          ...current,
          processingStatus: dead ? "DEAD_LETTER" : "FAILED",
          errorCodeSanitized,
          updatedAt: now,
        });
      },
      async findById(id) {
        return webhooks.get(id) ?? null;
      },
    },
    audit: {
      async append(event) {
        audit.push({
          ...event,
          metadata: sanitizeMetadata(event.metadata),
        });
      },
      async list(filter) {
        return audit.filter((e) => {
          if (filter?.aggregateType && e.aggregateType !== filter.aggregateType) return false;
          if (filter?.aggregateId && e.aggregateId !== filter.aggregateId) return false;
          if (filter?.correlationId && e.correlationId !== filter.correlationId) return false;
          return true;
        });
      },
    },
  };
}
