import type { CurrencyCode, PaymentEnvironment, ProviderName } from "../../../contracts/primitives";
import type { EditionCheckoutFinanceSnapshot } from "../../../edition-checkout/types.js";

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
  /** HTTPS notification URL for Mercado Pago TEST (Preferences). */
  notificationUrl?: string;
  isTestFixture?: boolean;
  /**
   * Snapshot financiero inmutable (Etapa 6). Obligatorio para mercado_pago_*.
   * No recalcular desde config activa.
   */
  editionFinance?: {
    snapshot: EditionCheckoutFinanceSnapshot;
    /** Token OAuth del collector (N=1). Nunca persistir ni loguear. */
    collectorAccessToken?: string;
  };
};

/** Bridge opcional: fake manual, Checkout Pro TEST, o Orders 1:N TEST. */
export type ClickatonCheckoutProviderBridge = {
  mode: "manual" | "mercado_pago_test" | "mercado_pago_orders_test";
  /** Provider name persisted on DNX orders. */
  providerName: ProviderName;
  createCheckout(input: {
    orderId: string;
    amountMinor: number;
    currency: CurrencyCode;
    description: string;
    externalReference: string;
    idempotencyKey: string;
    payloadHash: string;
    payerEmail?: string;
    successUrl: string;
    pendingUrl: string;
    failureUrl: string;
    notificationUrl?: string;
    checkoutBaseUrl?: string;
    sourceId: string;
    /** OAuth del beneficiario collector (Checkout Pro N=1). */
    collectorAccessToken?: string;
    collectorPaymentAccountId?: string;
    editionFinanceModality?: string;
  }): Promise<{
    checkoutUrl: string;
    providerOrderId: string;
    rawSanitized: Record<string, unknown>;
  }>;
  refreshCheckout?(input: {
    providerOrderId: string;
    externalReference: string;
    expectedAmountMinor: number;
    expectedCurrency: CurrencyCode;
  }): Promise<{
    status: NormalizedCheckoutStatus;
    amountMinor: number;
    currency: CurrencyCode;
    externalReference: string | null;
    liveMode: boolean;
    providerFeeMinor?: number | null;
    rawSanitized: Record<string, unknown>;
  } | null>;
  /** S2S por payment id (webhooks firmados Checkout Pro). */
  fetchPaymentById?(paymentId: string): Promise<{
    status: NormalizedCheckoutStatus;
    amountMinor: number;
    currency: CurrencyCode;
    externalReference: string | null;
    liveMode: boolean;
    providerPaymentId: string;
    providerFeeMinor?: number | null;
    rawSanitized: Record<string, unknown>;
  } | null>;
};

/** Origen durable del evento normalizado (inbox / auditoría). */
export type CheckoutEventOrigin =
  | "HTTP_WEBHOOK"
  | "S2S_REFRESH"
  | "RECONCILIATION"
  | "SIMULATION"
  | "NORMALIZED";

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
  /** Si se omite, se infiere por prefijo de eventId. */
  origin?: CheckoutEventOrigin;
  liveModeReported?: boolean | null;
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
