import type {
  CurrencyCode,
  PaymentEnvironment,
  PaymentIntentKind,
  ProductId,
  ProviderName,
  RecipientRole,
  WaitingMpConfirmation,
} from "./primitives.js";
import type { Money } from "../money/types.js";

export type PaymentIntentStatus =
  | "DRAFT"
  | "READY"
  | "SUBMITTED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED"
  | "EXPIRED";

export type PaymentOrderStatus =
  | "CREATED"
  | "AWAITING_PROVIDER"
  | "AUTHORIZED"
  | "CAPTURED"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "CHARGED_BACK"
  | "FAILED"
  | "CANCELED";

export type ProviderOrderStatus =
  | "PENDING"
  | "OPEN"
  | "PROCESSED"
  | "REFUNDED"
  | "CHARGED_BACK"
  | "FAILED"
  | "CANCELED";

export type PaymentAttemptStatus = "STARTED" | "SUCCEEDED" | "FAILED";

export type SplitConsentStatus =
  | "PENDING"
  | "ACTIVE"
  | "REJECTED"
  | "CANCELED"
  | "EXPIRED";

export type DistributionPlanStatus =
  | "DRAFT"
  | "CALCULATED"
  | "LOCKED"
  | "EXECUTED"
  | "SUPERSEDED";

export type SettlementStatus =
  | "OPEN"
  | "CALCULATED"
  | "APPROVED"
  | "PAID"
  | "FAILED"
  | "CANCELED";

export type RefundStatus =
  | "REQUESTED"
  | "SUBMITTED"
  | "PROCESSED"
  | "FAILED"
  | "CANCELED";

export type ChargebackStatus =
  | "OPEN"
  | "IN_PROCESS"
  | "WON"
  | "LOST"
  | "CLOSED";

export type WebhookInboxStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED"
  | "IGNORED";

export type BalanceAvailability = "AVAILABLE" | "HELD" | "PENDING";

export type LedgerAccountType =
  | "ASSET"
  | "LIABILITY"
  | "REVENUE"
  | "EXPENSE"
  | "CLEARING";

export interface Recipient {
  id: string;
  role: RecipientRole;
  /** Opaque product-side user/org reference — Payments does not interpret it. */
  productUserRef: string;
  displayLabel?: string;
}

export interface ProviderRecipient {
  id: string;
  recipientId: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  /** MP receiver_id UUID or numeric user_id as string */
  externalId: string;
  externalEmail?: string;
  consentId?: string;
}

export interface SplitConsent {
  id: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  primaryExternalUserId: string;
  sellerEmail: string;
  receiverId: string | null;
  status: SplitConsentStatus;
  inviteUrl: string | null;
  recipientId: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentIntent {
  id: string;
  productId: ProductId;
  kind: PaymentIntentKind;
  status: PaymentIntentStatus;
  environment: PaymentEnvironment;
  /** Opaque product reference (e.g. albumOrder:123). */
  externalReference: string;
  idempotencyKey: string;
  total: Money;
  payerEmail?: string;
  recipients: Recipient[];
  metadata?: Record<string, string>;
  distributionPlanId?: string;
  paymentOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentOrder {
  id: string;
  intentId: string;
  productId: ProductId;
  status: PaymentOrderStatus;
  environment: PaymentEnvironment;
  externalReference: string;
  total: Money;
  distributionPlanId: string;
  providerOrderIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProviderOrder {
  id: string;
  paymentOrderId: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  providerOrderId: string;
  status: ProviderOrderStatus;
  rawStatus?: string;
  rawStatusDetail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderPayment {
  id: string;
  providerOrderId: string;
  provider: ProviderName;
  providerPaymentId: string;
  status: string;
  amount: Money;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAttempt {
  id: string;
  intentId: string;
  attemptNumber: number;
  status: PaymentAttemptStatus;
  idempotencyKey: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type DistributionRuleKind = "PERCENTAGE" | "FIXED";

export interface DistributionRule {
  recipientId: string;
  role: RecipientRole;
  kind: DistributionRuleKind;
  /** FIXED: minor units as Money; PERCENTAGE: basis points (10000 = 100%). */
  percentageBps?: number;
  fixedAmount?: Money;
  priority: number;
  optional?: boolean;
}

export interface DistributionEntry {
  recipientId: string;
  role: RecipientRole;
  amount: Money;
  ruleKind: DistributionRuleKind;
  priority: number;
}

export interface DistributionPlan {
  id: string;
  intentId: string;
  status: DistributionPlanStatus;
  total: Money;
  entries: DistributionEntry[];
  roundingPolicy: string;
  /** Fee handling may remain unresolved until MP confirms. */
  feePolicy: WaitingMpConfirmation | string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerAccount {
  id: string;
  code: string;
  type: LedgerAccountType;
  currency: CurrencyCode;
  recipientId?: string;
  label: string;
}

export interface LedgerLeg {
  accountId: string;
  /** Signed minor units: positive = debit convention configurable; we use signed amount toward account. */
  amountMinor: bigint;
}

export interface LedgerEntry {
  id: string;
  journalId: string;
  currency: CurrencyCode;
  legs: LedgerLeg[];
  causeType: string;
  causeId: string;
  purpose: string;
  postedAt: string;
  metadata?: Record<string, string>;
}

export interface Balance {
  accountId: string;
  currency: CurrencyCode;
  amountMinor: bigint;
  availability: BalanceAvailability;
  asOf: string;
}

export interface Settlement {
  id: string;
  status: SettlementStatus;
  currency: CurrencyCode;
  cutoffAt: string;
  totalAmountMinor: bigint;
  recipientId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Refund {
  id: string;
  paymentOrderId: string;
  status: RefundStatus;
  amount: Money;
  /** If set, refund targets a single recipient share. */
  recipientId?: string;
  idempotencyKey: string;
  providerRefundId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chargeback {
  id: string;
  paymentOrderId: string;
  status: ChargebackStatus;
  amount: Money;
  providerChargebackId?: string;
  caseId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookInbox {
  id: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  eventKey: string;
  status: WebhookInboxStatus;
  payloadDigest: string;
  receivedAt: string;
  processedAt?: string;
}

export interface ReconciliationRun {
  id: string;
  provider: ProviderName;
  environment: PaymentEnvironment;
  status: "STARTED" | "COMPLETED" | "FAILED";
  startedAt: string;
  completedAt?: string;
  diffCount: number;
}

export interface AuditEvent {
  id: string;
  actorType: "system" | "user" | "provider" | "ops";
  actorId?: string;
  action: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  /** Never store secrets here. */
  data?: Record<string, string>;
}
