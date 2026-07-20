import type { PaymentEnvironment, ProviderName } from "../../contracts/primitives";
import type {
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
} from "../../application/persistence/types";
import type { DnxPaymentsPersistence } from "../../application/persistence/ports";
import { sanitizeMetadata } from "../../application/persistence/memory";

/** Narrow Prisma surface so core tests do not need a live DB. */
export interface DnxPaymentsPrismaDelegates {
  dnxPaymentRecipient: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
  };
  dnxProviderRecipientAccount: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  };
  dnxSplitConsent: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  };
  dnxPaymentIntent: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
  };
  dnxPaymentOrder: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  };
  dnxProviderOrder: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  };
  dnxProviderSplit: {
    createMany: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    count: (args: unknown) => Promise<number>;
  };
  dnxPaymentIdempotencyRecord: {
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    create: (args: unknown) => Promise<Record<string, unknown>>;
    update: (args: unknown) => Promise<unknown>;
  };
  dnxPaymentWebhookInbox: {
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    create: (args: unknown) => Promise<Record<string, unknown>>;
    update: (args: unknown) => Promise<unknown>;
  };
  dnxPaymentAuditEvent: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  };
}

export function mapProviderToPrisma(provider: ProviderName): string {
  switch (provider) {
    case "mercadopago":
      return "MERCADOPAGO";
    case "mercadopago_preferences_legacy":
      return "MERCADOPAGO_PREFERENCES_LEGACY";
    case "stripe":
      return "STRIPE";
    case "paypal":
      return "PAYPAL";
    case "transfer":
      return "TRANSFER";
    case "manual":
      return "MANUAL";
    default:
      return "OTHER";
  }
}

export function mapProviderFromPrisma(value: string): ProviderName {
  switch (value) {
    case "MERCADOPAGO":
      return "mercadopago";
    case "MERCADOPAGO_PREFERENCES_LEGACY":
      return "mercadopago_preferences_legacy";
    case "STRIPE":
      return "stripe";
    case "PAYPAL":
      return "paypal";
    case "TRANSFER":
      return "transfer";
    case "MANUAL":
      return "manual";
    default:
      return "other";
  }
}

export function mapEnvToPrisma(env: PaymentEnvironment): "SANDBOX" | "PRODUCTION" {
  return env === "sandbox" ? "SANDBOX" : "PRODUCTION";
}

export function mapEnvFromPrisma(value: string): PaymentEnvironment {
  return value === "SANDBOX" ? "sandbox" : "production";
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function optionalIso(value: unknown): string | null {
  if (value == null) return null;
  return iso(value);
}

function asBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  return 0n;
}

function mapRecipient(row: Record<string, unknown>): PersistedPaymentRecipient {
  const out: PersistedPaymentRecipient = {
    id: String(row.id),
    recipientType: row.recipientType as PersistedPaymentRecipient["recipientType"],
    status: row.status as PersistedPaymentRecipient["status"],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
  if (row.userId != null) out.userId = Number(row.userId);
  if (row.displayReference != null) out.displayReference = String(row.displayReference);
  return out;
}

function mapAccount(row: Record<string, unknown>): PersistedProviderRecipientAccount {
  const out: PersistedProviderRecipientAccount = {
    id: String(row.id),
    recipientId: String(row.recipientId),
    provider: mapProviderFromPrisma(String(row.provider)),
    environment: mapEnvFromPrisma(String(row.environment)),
    providerAccountReference: String(row.providerAccountReference),
    providerOwnerEligible: Boolean(row.providerOwnerEligible),
    status: row.status as PersistedProviderRecipientAccount["status"],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
  if (row.metadataSanitized && typeof row.metadataSanitized === "object") {
    out.metadataSanitized = row.metadataSanitized as Record<string, unknown>;
  }
  return out;
}

function mapConsent(row: Record<string, unknown>): PersistedSplitConsent {
  return {
    id: String(row.id),
    provider: mapProviderFromPrisma(String(row.provider)),
    environment: mapEnvFromPrisma(String(row.environment)),
    primaryProviderAccountReference: String(row.primaryProviderAccountReference),
    providerReceiverId: row.providerReceiverId == null ? null : String(row.providerReceiverId),
    recipientId: row.recipientId == null ? null : String(row.recipientId),
    status: String(row.status).replace("CANCELED", "CANCELED") as PersistedSplitConsent["status"],
    invitationReference: row.invitationReference == null ? null : String(row.invitationReference),
    providerCreatedAt: optionalIso(row.providerCreatedAt),
    providerUpdatedAt: optionalIso(row.providerUpdatedAt),
    lastCheckedAt: optionalIso(row.lastCheckedAt),
    source: row.source as PersistedSplitConsent["source"],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function mapIntent(row: Record<string, unknown>): PersistedPaymentIntent {
  const out: PersistedPaymentIntent = {
    id: String(row.id),
    sourceProduct: String(row.sourceProduct),
    externalReference: String(row.externalReference),
    currency: row.currency as PersistedPaymentIntent["currency"],
    totalMinor: asBigInt(row.totalMinor),
    status: row.status as PersistedPaymentIntent["status"],
    environment: mapEnvFromPrisma(String(row.environment)),
    isTestFixture: Boolean(row.isTestFixture),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
  if (row.distributionSnapshot && typeof row.distributionSnapshot === "object") {
    out.distributionSnapshot = row.distributionSnapshot as Record<string, unknown>;
  }
  if (row.providerPreference != null) out.providerPreference = String(row.providerPreference);
  return out;
}

function mapPaymentOrder(row: Record<string, unknown>): PersistedPaymentOrder {
  const out: PersistedPaymentOrder = {
    id: String(row.id),
    paymentIntentId: String(row.paymentIntentId),
    provider: mapProviderFromPrisma(String(row.provider)),
    environment: mapEnvFromPrisma(String(row.environment)),
    status: row.status as PersistedPaymentOrder["status"],
    amountMinor: asBigInt(row.amountMinor),
    currency: row.currency as PersistedPaymentOrder["currency"],
    ownerRecipientId: String(row.ownerRecipientId),
    isTestFixture: Boolean(row.isTestFixture),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
  if (row.distributionSnapshot && typeof row.distributionSnapshot === "object") {
    out.distributionSnapshot = row.distributionSnapshot as Record<string, unknown>;
  }
  if (row.idempotencyRecordId != null) out.idempotencyRecordId = String(row.idempotencyRecordId);
  return out;
}

function mapProviderOrder(row: Record<string, unknown>): PersistedProviderOrder {
  const out: PersistedProviderOrder = {
    id: String(row.id),
    paymentOrderId: String(row.paymentOrderId),
    provider: mapProviderFromPrisma(String(row.provider)),
    environment: mapEnvFromPrisma(String(row.environment)),
    providerOrderId: String(row.providerOrderId),
    mappedStatus: row.mappedStatus as PersistedProviderOrder["mappedStatus"],
    totalMinor: asBigInt(row.totalMinor),
    currency: row.currency as PersistedProviderOrder["currency"],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
  if (row.providerStatus != null) out.providerStatus = String(row.providerStatus);
  if (row.providerStatusDetail != null) out.providerStatusDetail = String(row.providerStatusDetail);
  if (row.rawResponseSanitized && typeof row.rawResponseSanitized === "object") {
    out.rawResponseSanitized = row.rawResponseSanitized as Record<string, unknown>;
  }
  if (row.lastFetchedAt != null) out.lastFetchedAt = iso(row.lastFetchedAt);
  return out;
}

function mapSplit(row: Record<string, unknown>): PersistedProviderSplit {
  const out: PersistedProviderSplit = {
    id: String(row.id),
    providerOrderId: String(row.providerOrderId),
    recipientId: String(row.recipientId),
    providerReceiverReference: String(row.providerReceiverReference),
    receiverType: row.receiverType as PersistedProviderSplit["receiverType"],
    currency: row.currency as PersistedProviderSplit["currency"],
    status: row.status as PersistedProviderSplit["status"],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
  if (row.amountMinor != null) out.amountMinor = asBigInt(row.amountMinor);
  if (row.percentageBps != null) out.percentageBps = Number(row.percentageBps);
  if (row.description != null) out.description = String(row.description);
  return out;
}

function mapIdempotency(row: Record<string, unknown>): PersistedIdempotencyRecord {
  const out: PersistedIdempotencyRecord = {
    id: String(row.id),
    operation: String(row.operation),
    provider: mapProviderFromPrisma(String(row.provider)),
    environment: mapEnvFromPrisma(String(row.environment)),
    idempotencyKey: String(row.idempotencyKey),
    payloadHash: String(row.payloadHash),
    status: row.status as PersistedIdempotencyRecord["status"],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
  if (row.aggregateType != null) out.aggregateType = String(row.aggregateType);
  if (row.aggregateId != null) out.aggregateId = String(row.aggregateId);
  if (row.providerReference != null) out.providerReference = String(row.providerReference);
  if (row.responseHash != null) out.responseHash = String(row.responseHash);
  if (row.lockedAt != null) out.lockedAt = iso(row.lockedAt);
  if (row.succeededAt != null) out.succeededAt = iso(row.succeededAt);
  if (row.failedAt != null) out.failedAt = iso(row.failedAt);
  return out;
}

function mapWebhook(row: Record<string, unknown>): PersistedWebhookInbox {
  const out: PersistedWebhookInbox = {
    id: String(row.id),
    provider: mapProviderFromPrisma(String(row.provider)),
    environment: mapEnvFromPrisma(String(row.environment)),
    eventType: String(row.eventType),
    providerEventId: row.providerEventId == null ? null : String(row.providerEventId),
    providerResourceId: row.providerResourceId == null ? null : String(row.providerResourceId),
    rawBodyHash: String(row.rawBodyHash),
    receivedAt: iso(row.receivedAt),
    processingStatus: row.processingStatus as PersistedWebhookInbox["processingStatus"],
    attempts: Number(row.attempts ?? 0),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
  if (row.headersHash != null) out.headersHash = String(row.headersHash);
  if (row.payloadSanitized && typeof row.payloadSanitized === "object") {
    out.payloadSanitized = row.payloadSanitized as Record<string, unknown>;
  }
  if (row.processedAt != null) out.processedAt = iso(row.processedAt);
  if (row.errorCodeSanitized != null) out.errorCodeSanitized = String(row.errorCodeSanitized);
  return out;
}

function mapAudit(row: Record<string, unknown>): PersistedAuditEvent {
  const actorTypeRaw = String(row.actorType).toLowerCase();
  const actorType =
    actorTypeRaw === "user" || actorTypeRaw === "provider" || actorTypeRaw === "ops"
      ? actorTypeRaw
      : "system";
  const out: PersistedAuditEvent = {
    id: String(row.id),
    actorType,
    action: String(row.action),
    aggregateType: String(row.aggregateType),
    aggregateId: String(row.aggregateId),
    result: row.result as PersistedAuditEvent["result"],
    createdAt: iso(row.createdAt),
  };
  if (row.actorReference != null) out.actorReference = String(row.actorReference);
  if (row.provider != null) out.provider = mapProviderFromPrisma(String(row.provider));
  if (row.environment != null) out.environment = mapEnvFromPrisma(String(row.environment));
  if (row.correlationId != null) out.correlationId = String(row.correlationId);
  if (row.errorCode != null) out.errorCode = String(row.errorCode);
  if (row.metadata && typeof row.metadata === "object") {
    out.metadata = row.metadata as Record<string, unknown>;
  }
  return out;
}

export function createPrismaDnxPaymentsPersistence(
  prisma: DnxPaymentsPrismaDelegates,
): DnxPaymentsPersistence {
  return {
    recipients: {
      async save(recipient) {
        await prisma.dnxPaymentRecipient.upsert({
          where: { id: recipient.id },
          create: {
            id: recipient.id,
            userId: recipient.userId ?? null,
            recipientType: recipient.recipientType,
            status: recipient.status,
            displayReference: recipient.displayReference ?? null,
            createdAt: new Date(recipient.createdAt),
            updatedAt: new Date(recipient.updatedAt),
          },
          update: {
            userId: recipient.userId ?? null,
            recipientType: recipient.recipientType,
            status: recipient.status,
            displayReference: recipient.displayReference ?? null,
            updatedAt: new Date(recipient.updatedAt),
          },
        });
      },
      async findById(id) {
        const row = await prisma.dnxPaymentRecipient.findUnique({ where: { id } });
        return row ? mapRecipient(row) : null;
      },
      async list() {
        const rows = await prisma.dnxPaymentRecipient.findMany();
        return rows.map(mapRecipient);
      },
    },
    providerAccounts: {
      async save(account) {
        await prisma.dnxProviderRecipientAccount.upsert({
          where: { id: account.id },
          create: {
            id: account.id,
            recipientId: account.recipientId,
            provider: mapProviderToPrisma(account.provider),
            environment: mapEnvToPrisma(account.environment),
            providerAccountReference: account.providerAccountReference,
            providerOwnerEligible: account.providerOwnerEligible,
            status: account.status,
            metadataSanitized: sanitizeMetadata(account.metadataSanitized) ?? null,
            createdAt: new Date(account.createdAt),
            updatedAt: new Date(account.updatedAt),
          },
          update: {
            status: account.status,
            providerOwnerEligible: account.providerOwnerEligible,
            metadataSanitized: sanitizeMetadata(account.metadataSanitized) ?? null,
            updatedAt: new Date(account.updatedAt),
          },
        });
      },
      async findById(id) {
        const row = await prisma.dnxProviderRecipientAccount.findUnique({ where: { id } });
        return row ? mapAccount(row) : null;
      },
      async findByReference(provider, environment, providerAccountReference) {
        const row = await prisma.dnxProviderRecipientAccount.findFirst({
          where: {
            provider: mapProviderToPrisma(provider),
            environment: mapEnvToPrisma(environment),
            providerAccountReference,
          },
        });
        return row ? mapAccount(row) : null;
      },
    },
    consents: {
      async save(consent) {
        await prisma.dnxSplitConsent.upsert({
          where: { id: consent.id },
          create: {
            id: consent.id,
            provider: mapProviderToPrisma(consent.provider),
            environment: mapEnvToPrisma(consent.environment),
            primaryProviderAccountReference: consent.primaryProviderAccountReference,
            providerReceiverId: consent.providerReceiverId,
            recipientId: consent.recipientId,
            status: consent.status === "CANCELED" ? "CANCELED" : consent.status,
            invitationReference: consent.invitationReference,
            providerCreatedAt: consent.providerCreatedAt ? new Date(consent.providerCreatedAt) : null,
            providerUpdatedAt: consent.providerUpdatedAt ? new Date(consent.providerUpdatedAt) : null,
            lastCheckedAt: consent.lastCheckedAt ? new Date(consent.lastCheckedAt) : null,
            source: consent.source,
            createdAt: new Date(consent.createdAt),
            updatedAt: new Date(consent.updatedAt),
          },
          update: {
            status: consent.status === "CANCELED" ? "CANCELED" : consent.status,
            providerReceiverId: consent.providerReceiverId,
            invitationReference: consent.invitationReference,
            lastCheckedAt: consent.lastCheckedAt ? new Date(consent.lastCheckedAt) : null,
            updatedAt: new Date(consent.updatedAt),
          },
        });
      },
      async findById(id) {
        const row = await prisma.dnxSplitConsent.findUnique({ where: { id } });
        return row ? mapConsent(row) : null;
      },
      async findByReceiverId(provider, environment, providerReceiverId) {
        const row = await prisma.dnxSplitConsent.findUnique({
          where: {
            provider_environment_providerReceiverId: {
              provider: mapProviderToPrisma(provider),
              environment: mapEnvToPrisma(environment),
              providerReceiverId,
            },
          },
        });
        return row ? mapConsent(row) : null;
      },
      async listActive(environment) {
        const rows = await prisma.dnxSplitConsent.findMany({
          where: {
            environment: mapEnvToPrisma(environment),
            status: "ACTIVE",
          },
        });
        return rows.map(mapConsent);
      },
    },
    intents: {
      async save(intent) {
        await prisma.dnxPaymentIntent.upsert({
          where: { id: intent.id },
          create: {
            id: intent.id,
            sourceProduct: String(intent.sourceProduct),
            externalReference: intent.externalReference,
            currency: intent.currency,
            totalMinor: intent.totalMinor,
            status: intent.status,
            distributionSnapshot: intent.distributionSnapshot ?? null,
            providerPreference: intent.providerPreference ?? null,
            environment: mapEnvToPrisma(intent.environment),
            isTestFixture: intent.isTestFixture,
            createdAt: new Date(intent.createdAt),
            updatedAt: new Date(intent.updatedAt),
          },
          update: {
            status: intent.status,
            distributionSnapshot: intent.distributionSnapshot ?? null,
            updatedAt: new Date(intent.updatedAt),
          },
        });
      },
      async findById(id) {
        const row = await prisma.dnxPaymentIntent.findUnique({ where: { id } });
        return row ? mapIntent(row) : null;
      },
      async findByExternalReference(sourceProduct, externalReference) {
        const row = await prisma.dnxPaymentIntent.findUnique({
          where: {
            sourceProduct_externalReference: { sourceProduct, externalReference },
          },
        });
        return row ? mapIntent(row) : null;
      },
    },
    paymentOrders: {
      async save(order) {
        await prisma.dnxPaymentOrder.upsert({
          where: { id: order.id },
          create: {
            id: order.id,
            paymentIntentId: order.paymentIntentId,
            provider: mapProviderToPrisma(order.provider),
            environment: mapEnvToPrisma(order.environment),
            status: order.status,
            amountMinor: order.amountMinor,
            currency: order.currency,
            ownerRecipientId: order.ownerRecipientId,
            distributionSnapshot: order.distributionSnapshot ?? null,
            idempotencyRecordId: order.idempotencyRecordId ?? null,
            isTestFixture: order.isTestFixture,
            createdAt: new Date(order.createdAt),
            updatedAt: new Date(order.updatedAt),
          },
          update: {
            status: order.status,
            distributionSnapshot: order.distributionSnapshot ?? null,
            updatedAt: new Date(order.updatedAt),
          },
        });
      },
      async findById(id) {
        const row = await prisma.dnxPaymentOrder.findUnique({ where: { id } });
        return row ? mapPaymentOrder(row) : null;
      },
      async listByPaymentIntentId(paymentIntentId) {
        const rows = await prisma.dnxPaymentOrder.findMany({
          where: { paymentIntentId },
          orderBy: { createdAt: "desc" },
        });
        return rows.map(mapPaymentOrder);
      },
    },
    providerOrders: {
      async save(order) {
        await prisma.dnxProviderOrder.upsert({
          where: { id: order.id },
          create: {
            id: order.id,
            paymentOrderId: order.paymentOrderId,
            provider: mapProviderToPrisma(order.provider),
            environment: mapEnvToPrisma(order.environment),
            providerOrderId: order.providerOrderId,
            providerStatus: order.providerStatus ?? null,
            providerStatusDetail: order.providerStatusDetail ?? null,
            mappedStatus: order.mappedStatus === "UNKNOWN" ? "UNKNOWN" : order.mappedStatus,
            totalMinor: order.totalMinor,
            currency: order.currency,
            rawResponseSanitized: sanitizeMetadata(order.rawResponseSanitized) ?? null,
            lastFetchedAt: order.lastFetchedAt ? new Date(order.lastFetchedAt) : null,
            createdAt: new Date(order.createdAt),
            updatedAt: new Date(order.updatedAt),
          },
          update: {
            providerStatus: order.providerStatus ?? null,
            providerStatusDetail: order.providerStatusDetail ?? null,
            mappedStatus: order.mappedStatus === "UNKNOWN" ? "UNKNOWN" : order.mappedStatus,
            rawResponseSanitized: sanitizeMetadata(order.rawResponseSanitized) ?? null,
            lastFetchedAt: order.lastFetchedAt ? new Date(order.lastFetchedAt) : null,
            updatedAt: new Date(order.updatedAt),
          },
        });
      },
      async findByProviderOrderId(provider, environment, providerOrderId) {
        const row = await prisma.dnxProviderOrder.findUnique({
          where: {
            provider_environment_providerOrderId: {
              provider: mapProviderToPrisma(provider),
              environment: mapEnvToPrisma(environment),
              providerOrderId,
            },
          },
        });
        return row ? mapProviderOrder(row) : null;
      },
      async findById(id) {
        const row = await prisma.dnxProviderOrder.findUnique({ where: { id } });
        return row ? mapProviderOrder(row) : null;
      },
      async findByPaymentOrderId(paymentOrderId) {
        const row = await prisma.dnxProviderOrder.findFirst({
          where: { paymentOrderId },
          orderBy: { createdAt: "desc" },
        });
        return row ? mapProviderOrder(row) : null;
      },
    },
    providerSplits: {
      async saveMany(splits) {
        if (splits.length === 0) return;
        const providerOrderId = splits[0]!.providerOrderId;
        const existing = await prisma.dnxProviderSplit.count({ where: { providerOrderId } });
        if (existing > 0) {
          throw new Error("provider splits are immutable after create");
        }
        await prisma.dnxProviderSplit.createMany({
          data: splits.map((s) => ({
            id: s.id,
            providerOrderId: s.providerOrderId,
            recipientId: s.recipientId,
            providerReceiverReference: s.providerReceiverReference,
            receiverType: s.receiverType,
            amountMinor: s.amountMinor ?? null,
            percentageBps: s.percentageBps ?? null,
            currency: s.currency,
            description: s.description ?? null,
            status: s.status,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          })),
        });
      },
      async listByProviderOrderId(providerOrderId) {
        const rows = await prisma.dnxProviderSplit.findMany({ where: { providerOrderId } });
        return rows.map(mapSplit);
      },
    },
    idempotency: {
      async reserve(input) {
        const existing = await prisma.dnxPaymentIdempotencyRecord.findUnique({
          where: {
            provider_environment_idempotencyKey: {
              provider: mapProviderToPrisma(input.provider),
              environment: mapEnvToPrisma(input.environment),
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (existing) {
          const record = mapIdempotency(existing);
          if (record.payloadHash === input.payloadHash) {
            return { kind: "SAME_PAYLOAD", record };
          }
          await prisma.dnxPaymentIdempotencyRecord.update({
            where: { id: record.id },
            data: { status: "CONFLICT", updatedAt: new Date(input.now) },
          });
          return { kind: "CONFLICT", record: { ...record, status: "CONFLICT", updatedAt: input.now } };
        }
        const created = await prisma.dnxPaymentIdempotencyRecord.create({
          data: {
            id: input.id,
            operation: input.operation,
            aggregateType: input.aggregateType ?? null,
            aggregateId: input.aggregateId ?? null,
            provider: mapProviderToPrisma(input.provider),
            environment: mapEnvToPrisma(input.environment),
            idempotencyKey: input.idempotencyKey,
            payloadHash: input.payloadHash,
            status: "PROCESSING",
            lockedAt: new Date(input.now),
            createdAt: new Date(input.now),
            updatedAt: new Date(input.now),
          },
        });
        return { kind: "CREATED", record: mapIdempotency(created) };
      },
      async markSucceeded(id, input) {
        await prisma.dnxPaymentIdempotencyRecord.update({
          where: { id },
          data: {
            status: "SUCCEEDED",
            providerReference: input.providerReference ?? null,
            responseHash: input.responseHash ?? null,
            succeededAt: new Date(input.now),
            updatedAt: new Date(input.now),
          },
        });
      },
      async markFailed(id, now) {
        await prisma.dnxPaymentIdempotencyRecord.update({
          where: { id },
          data: { status: "FAILED", failedAt: new Date(now), updatedAt: new Date(now) },
        });
      },
      async find(provider, environment, idempotencyKey) {
        const row = await prisma.dnxPaymentIdempotencyRecord.findUnique({
          where: {
            provider_environment_idempotencyKey: {
              provider: mapProviderToPrisma(provider),
              environment: mapEnvToPrisma(environment),
              idempotencyKey,
            },
          },
        });
        return row ? mapIdempotency(row) : null;
      },
    },
    webhooks: {
      async ingest(record) {
        const existing = await prisma.dnxPaymentWebhookInbox.findUnique({
          where: {
            provider_environment_providerEventId_providerResourceId: {
              provider: mapProviderToPrisma(record.provider),
              environment: mapEnvToPrisma(record.environment),
              providerEventId: record.providerEventId,
              providerResourceId: record.providerResourceId,
            },
          },
        });
        if (existing) {
          return { kind: "DUPLICATE", record: mapWebhook(existing) };
        }
        const created = await prisma.dnxPaymentWebhookInbox.create({
          data: {
            id: record.id,
            provider: mapProviderToPrisma(record.provider),
            environment: mapEnvToPrisma(record.environment),
            eventType: record.eventType,
            providerEventId: record.providerEventId,
            providerResourceId: record.providerResourceId,
            headersHash: record.headersHash ?? null,
            rawBodyHash: record.rawBodyHash,
            payloadSanitized: sanitizeMetadata(record.payloadSanitized) ?? null,
            receivedAt: new Date(record.receivedAt),
            processingStatus: record.processingStatus,
            attempts: record.attempts,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
          },
        });
        return { kind: "INSERTED", record: mapWebhook(created) };
      },
      async markProcessing(id, now) {
        const current = await prisma.dnxPaymentWebhookInbox.findUnique({ where: { id } });
        if (!current) return;
        await prisma.dnxPaymentWebhookInbox.update({
          where: { id },
          data: {
            processingStatus: "PROCESSING",
            attempts: Number(current.attempts ?? 0) + 1,
            updatedAt: new Date(now),
          },
        });
      },
      async markProcessed(id, now) {
        await prisma.dnxPaymentWebhookInbox.update({
          where: { id },
          data: {
            processingStatus: "PROCESSED",
            processedAt: new Date(now),
            updatedAt: new Date(now),
          },
        });
      },
      async markFailed(id, errorCodeSanitized, now) {
        const current = await prisma.dnxPaymentWebhookInbox.findUnique({ where: { id } });
        if (!current) return;
        const attempts = Number(current.attempts ?? 0);
        await prisma.dnxPaymentWebhookInbox.update({
          where: { id },
          data: {
            processingStatus: attempts >= 5 ? "DEAD_LETTER" : "FAILED",
            errorCodeSanitized,
            updatedAt: new Date(now),
          },
        });
      },
      async findById(id) {
        const row = await prisma.dnxPaymentWebhookInbox.findUnique({ where: { id } });
        return row ? mapWebhook(row) : null;
      },
    },
    audit: {
      async append(event) {
        await prisma.dnxPaymentAuditEvent.create({
          data: {
            id: event.id,
            actorType: event.actorType.toUpperCase(),
            actorReference: event.actorReference ?? null,
            action: event.action,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            provider: event.provider ? mapProviderToPrisma(event.provider) : null,
            environment: event.environment ? mapEnvToPrisma(event.environment) : null,
            correlationId: event.correlationId ?? null,
            result: event.result,
            errorCode: event.errorCode ?? null,
            metadata: sanitizeMetadata(event.metadata) ?? null,
            createdAt: new Date(event.createdAt),
          },
        });
      },
      async list(filter) {
        const rows = await prisma.dnxPaymentAuditEvent.findMany({
          where: {
            ...(filter?.aggregateType ? { aggregateType: filter.aggregateType } : {}),
            ...(filter?.aggregateId ? { aggregateId: filter.aggregateId } : {}),
            ...(filter?.correlationId ? { correlationId: filter.correlationId } : {}),
          },
          orderBy: { createdAt: "asc" },
        });
        return rows.map(mapAudit);
      },
    },
  };
}
