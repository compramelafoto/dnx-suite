import type { PaymentEnvironment, ProviderName } from "../../contracts/primitives";
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
} from "./types";

export interface PaymentRecipientStore {
  save(recipient: PersistedPaymentRecipient): Promise<void>;
  findById(id: string): Promise<PersistedPaymentRecipient | null>;
  list(): Promise<PersistedPaymentRecipient[]>;
}

export interface ProviderRecipientAccountStore {
  save(account: PersistedProviderRecipientAccount): Promise<void>;
  findById(id: string): Promise<PersistedProviderRecipientAccount | null>;
  findByReference(
    provider: ProviderName,
    environment: PaymentEnvironment,
    providerAccountReference: string,
  ): Promise<PersistedProviderRecipientAccount | null>;
}

export interface SplitConsentStore {
  save(consent: PersistedSplitConsent): Promise<void>;
  findById(id: string): Promise<PersistedSplitConsent | null>;
  findByReceiverId(
    provider: ProviderName,
    environment: PaymentEnvironment,
    providerReceiverId: string,
  ): Promise<PersistedSplitConsent | null>;
  listActive(environment: PaymentEnvironment): Promise<PersistedSplitConsent[]>;
}

export interface PaymentIntentStore {
  save(intent: PersistedPaymentIntent): Promise<void>;
  findById(id: string): Promise<PersistedPaymentIntent | null>;
  findByExternalReference(
    sourceProduct: string,
    externalReference: string,
  ): Promise<PersistedPaymentIntent | null>;
}

export interface PaymentOrderStore {
  save(order: PersistedPaymentOrder): Promise<void>;
  findById(id: string): Promise<PersistedPaymentOrder | null>;
  /** Órdenes internas de un intent (más recientes primero). */
  listByPaymentIntentId(paymentIntentId: string): Promise<PersistedPaymentOrder[]>;
}

export interface ProviderOrderStore {
  save(order: PersistedProviderOrder): Promise<void>;
  findByProviderOrderId(
    provider: ProviderName,
    environment: PaymentEnvironment,
    providerOrderId: string,
  ): Promise<PersistedProviderOrder | null>;
  findById(id: string): Promise<PersistedProviderOrder | null>;
  findByPaymentOrderId(paymentOrderId: string): Promise<PersistedProviderOrder | null>;
}

export interface ProviderSplitStore {
  saveMany(splits: PersistedProviderSplit[]): Promise<void>;
  listByProviderOrderId(providerOrderId: string): Promise<PersistedProviderSplit[]>;
}

export interface PaymentIdempotencyStore {
  reserve(input: {
    operation: string;
    provider: ProviderName;
    environment: PaymentEnvironment;
    idempotencyKey: string;
    payloadHash: string;
    aggregateType?: string;
    aggregateId?: string;
    now: string;
    id: string;
  }): Promise<IdempotencyReserveResult>;
  markSucceeded(
    id: string,
    input: { providerReference?: string; responseHash?: string; now: string },
  ): Promise<void>;
  markFailed(id: string, now: string): Promise<void>;
  find(
    provider: ProviderName,
    environment: PaymentEnvironment,
    idempotencyKey: string,
  ): Promise<PersistedIdempotencyRecord | null>;
}

export interface WebhookInboxStore {
  ingest(record: PersistedWebhookInbox): Promise<WebhookIngestResult>;
  markProcessing(id: string, now: string): Promise<void>;
  markProcessed(id: string, now: string): Promise<void>;
  markFailed(id: string, errorCodeSanitized: string, now: string): Promise<void>;
  findById(id: string): Promise<PersistedWebhookInbox | null>;
}

export interface PaymentAuditStore {
  append(event: PersistedAuditEvent): Promise<void>;
  list(filter?: {
    aggregateType?: string;
    aggregateId?: string;
    correlationId?: string;
  }): Promise<PersistedAuditEvent[]>;
}

export interface DnxPaymentsPersistence {
  recipients: PaymentRecipientStore;
  providerAccounts: ProviderRecipientAccountStore;
  consents: SplitConsentStore;
  intents: PaymentIntentStore;
  paymentOrders: PaymentOrderStore;
  providerOrders: ProviderOrderStore;
  providerSplits: ProviderSplitStore;
  idempotency: PaymentIdempotencyStore;
  webhooks: WebhookInboxStore;
  audit: PaymentAuditStore;
}
