import type { PaymentEnvironment } from "../../contracts/primitives.js";
import type { Money } from "../../money/types.js";
import type { CalculatedDistribution } from "../../distribution/types.js";

export interface InviteSplitRecipientsCommand {
  environment: PaymentEnvironment;
  sellerEmails: string[];
  idempotencyKey: string;
}

export interface RefreshSplitConsentCommand {
  environment: PaymentEnvironment;
  receiverId?: string;
}

export interface CancelSplitConsentCommand {
  environment: PaymentEnvironment;
  receiverId: string;
}

export interface CreateSplitPaymentOrderCommand {
  environment: PaymentEnvironment;
  externalReference: string;
  total: Money;
  distribution: CalculatedDistribution;
  payerEmail?: string;
  idempotencyKey: string;
  deviceSessionId: string;
  partnerReceiverIds: Map<string, string>;
  metadata?: Record<string, string>;
}

export interface RefreshProviderOrderCommand {
  environment: PaymentEnvironment;
  providerOrderId: string;
}
