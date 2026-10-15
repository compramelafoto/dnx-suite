import type { PaymentEnvironment, ProviderName, CurrencyCode } from "../contracts/primitives.js";
import type { Money } from "../money/types.js";
import type { CalculatedDistribution } from "../distribution/types.js";
import type { SplitConsentStatus } from "../contracts/entities.js";

export interface ProviderCapabilities {
  supportsSplit1N: boolean;
  supportsMarketplaceFee: boolean;
  supportsRefundPerRecipient: boolean;
  supportsDeviceId: boolean;
  supportsSplitConsent: boolean;
  supportedCurrencies: CurrencyCode[];
}

export interface CreateProviderOrderInput {
  environment: PaymentEnvironment;
  externalReference: string;
  total: Money;
  distribution: CalculatedDistribution;
  /** Required for Mercado Pago Orders 1:N createSplitOrder. */
  payerEmail?: string;
  idempotencyKey: string;
  /**
   * Payer device/session context for x-meli-session-id.
   * Must come from frontend (Brick) — not server-invented.
   * DEVICE CONTEXT FRONTEND BLOCKED UNTIL BRICK for production capture.
   */
  deviceSessionId?: string;
  /** Card token from MercadoPago.js (TEST) — never log. */
  paymentToken?: string;
  /** MP payment_method.id (e.g. visa) — required by Orders when token is sent. */
  paymentMethodId?: string;
  /** Installments from Brick (default 1). */
  installments?: number;
  metadata?: Record<string, string>;
}

export interface CreateProviderOrderResult {
  providerOrderId: string;
  status: string;
  raw?: unknown;
}

export interface GetProviderOrderResult {
  providerOrderId: string;
  status: string;
  statusDetail?: string;
  payments: Array<{ providerPaymentId: string; status: string; amount: Money }>;
}

/** Un destinatario del reembolso dentro de una orden con split. */
export interface ProviderRefundSplitTarget {
  /** Identificador del receptor en el proveedor (owner user id o partner receiver id). */
  receiverId: string;
  /** Omitido = se reembolsa la pata completa de ese receptor. */
  amount?: Money;
}

export interface ProviderRefundInput {
  providerOrderId: string;
  /**
   * A quién se le reembolsa, en órdenes con split. Vacío u omitido = reembolso
   * total de la orden.
   *
   * Mercado Pago Orders dirige el reembolso **al participante**, no a la
   * transacción de pago: por eso acá va el receptor y no un id de pago.
   */
  splits?: ProviderRefundSplitTarget[];
  /** Monto del reembolso parcial. Lo usan los proveedores sin split (p. ej. Stripe). */
  amount?: Money;
  /** Id de la transacción de pago. Lo usan los proveedores sin split. */
  providerTransactionId?: string;
  /**
   * Identificador interno del destinatario, para contabilidad propia.
   * No se envía al proveedor.
   */
  recipientExternalId?: string;
  idempotencyKey: string;
}

export interface ProviderRefundResult {
  providerRefundId: string;
  providerRefundIds?: string[];
  orderStatus?: string;
  statusDetail?: string;
  rawSanitized?: Record<string, unknown>;
}

export interface NormalizedWebhook {
  eventKey: string;
  providerOrderId: string;
  action?: string;
  liveMode: boolean;
}

export interface PaymentProvider {
  readonly name: ProviderName;
  capabilities(): ProviderCapabilities;
  createOrder(input: CreateProviderOrderInput): Promise<CreateProviderOrderResult>;
  getOrder(providerOrderId: string, environment: PaymentEnvironment): Promise<GetProviderOrderResult>;
  refund(input: ProviderRefundInput): Promise<ProviderRefundResult>;
  parseWebhook(
    headers: Record<string, string | undefined>,
    rawBody: string,
    environment: PaymentEnvironment,
  ): Promise<NormalizedWebhook>;
}

export interface SplitConsentProvider {
  invite(input: {
    environment: PaymentEnvironment;
    sellerEmails: string[];
    idempotencyKey: string;
    forceStatus?: SplitConsentStatus;
  }): Promise<
    Array<{
      sellerEmail: string;
      receiverId: string;
      status: SplitConsentStatus;
      inviteUrl?: string;
    }>
  >;
  list(input: {
    environment: PaymentEnvironment;
    status?: SplitConsentStatus;
  }): Promise<
    Array<{
      receiverId: string;
      sellerEmail: string;
      status: SplitConsentStatus;
    }>
  >;
  cancel(input: {
    environment: PaymentEnvironment;
    receiverId: string;
  }): Promise<{ status: SplitConsentStatus }>;
}
