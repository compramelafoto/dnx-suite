import type { CurrencyCode, PaymentEnvironment, ProviderName } from "../../../contracts/primitives";

/** Estados normalizados hacia apps consumidoras (Clickatón). */
export type NormalizedCheckoutStatus =
  | "CREATED"
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  | "CHARGEBACK";

export type CreateClickatonCheckoutOrderInput = {
  sourceApp: "CLICKATON";
  sourceType: "REGISTRATION";
  sourceId: string;
  idempotencyKey: string;
  payloadHash: string;
  amountMinor: number;
  currency: CurrencyCode;
  description: string;
  successUrl: string;
  pendingUrl: string;
  failureUrl: string;
  payerEmail?: string;
  environment?: PaymentEnvironment;
  /** Base URL del checkout fake (sin query). */
  checkoutBaseUrl?: string;
  isTestFixture?: boolean;
};

export type DurableCheckoutOrder = {
  id: string;
  intentId: string;
  provider: ProviderName;
  status: NormalizedCheckoutStatus;
  amountMinor: number;
  currency: CurrencyCode;
  externalReference: string;
  checkoutUrl: string | null;
  sourceApp: "CLICKATON";
  sourceType: "REGISTRATION";
  sourceId: string;
  idempotencyKey: string;
  payloadHash: string;
  attempt: number;
  providerOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  lastEventId: string | null;
  lastEventAt: string | null;
  eventsCount: number;
};

export type CreateClickatonCheckoutOrderResult =
  | { outcome: "created"; order: DurableCheckoutOrder }
  | { outcome: "reused"; order: DurableCheckoutOrder }
  | { outcome: "conflict"; code: "IDEMPOTENCY_CONFLICT"; message: string };

export type NormalizedCheckoutEvent = {
  eventId: string;
  orderId: string;
  status: NormalizedCheckoutStatus;
  amountMinor: number;
  currency: CurrencyCode;
  provider: ProviderName | string;
  externalReference: string;
  sourceId: string;
  receivedAt: string;
};

export type ApplyNormalizedCheckoutEventResult = {
  outcome: "applied" | "duplicate" | "conflict" | "not_found";
  conflictCode?: string;
  order: DurableCheckoutOrder | null;
  inboxId: string | null;
};

export type ReconcileCheckoutFinding = {
  code: string;
  detail: string;
};

export type ReconcileClickatonCheckoutResult = {
  status: "CONSISTENT" | "REPAIRED" | "MANUAL_REVIEW";
  findings: string[];
  actions: string[];
};
