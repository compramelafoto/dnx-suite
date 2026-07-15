import type { ProductId } from "../contracts/primitives.js";
import type { Money } from "../money/types.js";
import type { CalculatedDistribution } from "../distribution/types.js";

export interface DomainEventBase {
  eventId: string;
  eventType: string;
  occurredAt: string;
  aggregateType: string;
  aggregateId: string;
  productId?: ProductId;
}

export interface PaymentIntentCreated extends DomainEventBase {
  eventType: "PaymentIntentCreated";
  aggregateType: "PaymentIntent";
  total: Money;
  externalReference: string;
}

export interface DistributionCalculated extends DomainEventBase {
  eventType: "DistributionCalculated";
  aggregateType: "DistributionPlan";
  intentId: string;
  distribution: CalculatedDistribution;
}

export interface ProviderOrderCreated extends DomainEventBase {
  eventType: "ProviderOrderCreated";
  aggregateType: "ProviderOrder";
  provider: string;
  providerOrderId: string;
  paymentOrderId: string;
}

export interface PaymentApproved extends DomainEventBase {
  eventType: "PaymentApproved";
  aggregateType: "PaymentOrder";
  providerOrderId: string;
  total: Money;
}

export interface RefundProcessed extends DomainEventBase {
  eventType: "RefundProcessed";
  aggregateType: "Refund";
  paymentOrderId: string;
  amount: Money;
  recipientId?: string;
}

export interface ChargebackReceived extends DomainEventBase {
  eventType: "ChargebackReceived";
  aggregateType: "Chargeback";
  paymentOrderId: string;
  amount: Money;
}

export interface SettlementGenerated extends DomainEventBase {
  eventType: "SettlementGenerated";
  aggregateType: "Settlement";
  totalAmountMinor: string;
  currency: string;
}

export interface PayoutCompleted extends DomainEventBase {
  eventType: "PayoutCompleted";
  aggregateType: "Settlement";
  settlementId: string;
}

export type DomainEvent =
  | PaymentIntentCreated
  | DistributionCalculated
  | ProviderOrderCreated
  | PaymentApproved
  | RefundProcessed
  | ChargebackReceived
  | SettlementGenerated
  | PayoutCompleted
  | (DomainEventBase & { eventType: string });
