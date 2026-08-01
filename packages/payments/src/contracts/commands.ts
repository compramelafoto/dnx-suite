import type { CurrencyCode, PaymentEnvironment, ProductId } from "./primitives.js";
import type { DistributionRule } from "./entities.js";
import type { Money } from "../money/types.js";
import type { RoundingPolicy, PercentageBase, OptionalRecipientPolicy } from "../distribution/types.js";

export interface CreatePaymentIntentCommand {
  productId: ProductId;
  kind: string;
  environment: PaymentEnvironment;
  externalReference: string;
  idempotencyKey: string;
  total: Money;
  payerEmail?: string;
  recipientIds: string[];
  distributionRules: DistributionRule[];
  metadata?: Record<string, string>;
}

export interface CalculateDistributionCommand {
  intentId: string;
  total: Money;
  rules: DistributionRule[];
  rounding: RoundingPolicy;
  percentageBase?: PercentageBase;
  optionalPolicy?: OptionalRecipientPolicy;
  eligibleRecipientIds: string[];
}

export interface SubmitPaymentIntentCommand {
  intentId: string;
  provider: string;
  attemptIdempotencyKey: string;
  deviceSessionId?: string;
}

export interface ProcessProviderWebhookCommand {
  provider: string;
  environment: PaymentEnvironment;
  eventKey: string;
  payloadDigest: string;
  providerOrderId: string;
}

export interface RequestRefundCommand {
  paymentOrderId: string;
  /** Omit for total remaining refund. */
  amount?: Money;
  /** Not sent to MP Orders refund API — internal accounting only. */
  recipientId?: string;
  idempotencyKey: string;
  reason?:
    | "customer_request"
    | "duplicate"
    | "event_cancelled"
    | "partial_adjustment"
    | "admin_correction";
}

export interface OpenSettlementCommand {
  currency: CurrencyCode;
  cutoffAt: string;
  recipientId?: string;
}
