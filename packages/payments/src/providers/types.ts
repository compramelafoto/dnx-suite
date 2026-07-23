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
  payerEmail?: string;
  idempotencyKey: string;
  deviceSessionId?: string;
  /** Card token from MercadoPago.js (TEST) — never log. */
  paymentToken?: string;
  /** MP payment_method.id (e.g. visa) — required by Orders when token is sent. */
  paymentMethodId?: string;
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

export interface ProviderRefundInput {
  providerOrderId: string;
  amount?: Money;
  recipientExternalId?: string;
  idempotencyKey: string;
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
  refund(input: ProviderRefundInput): Promise<{ providerRefundId: string }>;
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
