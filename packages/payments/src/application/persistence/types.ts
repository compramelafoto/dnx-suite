import type { CurrencyCode, PaymentEnvironment, ProductId, ProviderName } from "../../contracts/primitives.js";
import type {
  PaymentIntentStatus,
  PaymentOrderStatus,
  ProviderOrderStatus,
  SplitConsentStatus,
  WebhookInboxStatus,
} from "../../contracts/entities.js";

export type PersistedRecipientType =
  | "PLATFORM"
  | "PHOTOGRAPHER"
  | "ORGANIZER"
  | "LAB"
  | "INFOSPOT_EDITOR"
  | "REFERRAL"
  | "AMBASSADOR"
  | "DELEGATE"
  | "SPONSOR"
  | "AFFILIATE"
  | "OTHER";

export type PersistedRecipientStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type PersistedAccountStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "REVOKED";

export type PersistedConsentSource = "SMOKE" | "MCP" | "APPLICATION" | "MANUAL" | "IMPORT";

export type PersistedIdempotencyStatus = "PROCESSING" | "SUCCEEDED" | "FAILED" | "CONFLICT";

export type PersistedAuditResult = "SUCCEEDED" | "FAILED" | "DENIED" | "SKIPPED";

export type PersistedSplitReceiverType = "OWNER" | "PARTNER";

export type PersistedSplitStatus = "PLANNED" | "SUBMITTED" | "CONFIRMED" | "FAILED";

export type PersistedWebhookStatus =
  | WebhookInboxStatus
  | "DEAD_LETTER";

export interface PersistedPaymentRecipient {
  id: string;
  userId?: number;
  recipientType: PersistedRecipientType;
  status: PersistedRecipientStatus;
  displayReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedProviderRecipientAccount {
  id: string;
  recipientId: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  providerAccountReference: string;
  providerOwnerEligible: boolean;
  status: PersistedAccountStatus;
  metadataSanitized?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedSplitConsent {
  id: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  primaryProviderAccountReference: string;
  providerReceiverId: string | null;
  recipientId: string | null;
  status: SplitConsentStatus;
  invitationReference: string | null;
  providerCreatedAt: string | null;
  providerUpdatedAt: string | null;
  lastCheckedAt: string | null;
  source: PersistedConsentSource;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedPaymentIntent {
  id: string;
  sourceProduct: ProductId | string;
  externalReference: string;
  currency: CurrencyCode;
  totalMinor: bigint;
  status: PaymentIntentStatus;
  distributionSnapshot?: Record<string, unknown>;
  providerPreference?: string;
  environment: PaymentEnvironment;
  isTestFixture: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedPaymentOrder {
  id: string;
  paymentIntentId: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  status: PaymentOrderStatus;
  amountMinor: bigint;
  currency: CurrencyCode;
  ownerRecipientId: string;
  distributionSnapshot?: Record<string, unknown>;
  idempotencyRecordId?: string;
  isTestFixture: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedProviderOrder {
  id: string;
  paymentOrderId: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  providerOrderId: string;
  providerStatus?: string;
  providerStatusDetail?: string;
  mappedStatus: ProviderOrderStatus | "UNKNOWN";
  totalMinor: bigint;
  currency: CurrencyCode;
  rawResponseSanitized?: Record<string, unknown>;
  lastFetchedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedProviderSplit {
  id: string;
  providerOrderId: string;
  recipientId: string;
  providerReceiverReference: string;
  receiverType: PersistedSplitReceiverType;
  amountMinor?: bigint;
  percentageBps?: number;
  currency: CurrencyCode;
  description?: string;
  status: PersistedSplitStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedIdempotencyRecord {
  id: string;
  operation: string;
  aggregateType?: string;
  aggregateId?: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  idempotencyKey: string;
  payloadHash: string;
  status: PersistedIdempotencyStatus;
  providerReference?: string;
  responseHash?: string;
  lockedAt?: string;
  succeededAt?: string;
  failedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedWebhookInbox {
  id: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  eventType: string;
  providerEventId: string | null;
  providerResourceId: string | null;
  headersHash?: string;
  rawBodyHash: string;
  payloadSanitized?: Record<string, unknown>;
  receivedAt: string;
  processingStatus: PersistedWebhookStatus;
  attempts: number;
  processedAt?: string;
  errorCodeSanitized?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedAuditEvent {
  id: string;
  actorType: "system" | "user" | "provider" | "ops";
  actorReference?: string;
  action: string;
  aggregateType: string;
  aggregateId: string;
  provider?: ProviderName;
  environment?: PaymentEnvironment;
  correlationId?: string;
  result: PersistedAuditResult;
  errorCode?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type IdempotencyReserveResult =
  | { kind: "CREATED"; record: PersistedIdempotencyRecord }
  | { kind: "SAME_PAYLOAD"; record: PersistedIdempotencyRecord }
  | { kind: "CONFLICT"; record: PersistedIdempotencyRecord };

export type WebhookIngestResult =
  | { kind: "INSERTED"; record: PersistedWebhookInbox }
  | { kind: "DUPLICATE"; record: PersistedWebhookInbox };
