import type {
  ChargebackStatus,
  PaymentIntentStatus,
  PaymentOrderStatus,
  RefundStatus,
  SettlementStatus,
  SplitConsentStatus,
} from "../contracts/entities.js";

export class InvalidTransitionError extends Error {
  constructor(
    public readonly entity: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`invalid ${entity} transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

const INTENT: Record<PaymentIntentStatus, readonly PaymentIntentStatus[]> = {
  DRAFT: ["READY", "CANCELED"],
  READY: ["SUBMITTED", "CANCELED", "EXPIRED"],
  SUBMITTED: ["SUCCEEDED", "FAILED", "CANCELED", "EXPIRED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELED: [],
  EXPIRED: [],
};

const ORDER: Record<PaymentOrderStatus, readonly PaymentOrderStatus[]> = {
  CREATED: ["AWAITING_PROVIDER", "CANCELED", "FAILED"],
  AWAITING_PROVIDER: ["AUTHORIZED", "CAPTURED", "PAID", "FAILED", "CANCELED"],
  AUTHORIZED: ["CAPTURED", "PAID", "CANCELED", "FAILED"],
  CAPTURED: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "CHARGED_BACK"],
  PAID: ["PARTIALLY_REFUNDED", "REFUNDED", "CHARGED_BACK"],
  PARTIALLY_REFUNDED: ["REFUNDED", "CHARGED_BACK", "PARTIALLY_REFUNDED"],
  REFUNDED: [],
  CHARGED_BACK: [],
  FAILED: [],
  CANCELED: [],
};

const CONSENT: Record<SplitConsentStatus, readonly SplitConsentStatus[]> = {
  PENDING: ["ACTIVE", "REJECTED", "CANCELED", "EXPIRED"],
  ACTIVE: ["CANCELED"],
  REJECTED: [],
  CANCELED: [],
  EXPIRED: [],
};

const REFUND: Record<RefundStatus, readonly RefundStatus[]> = {
  REQUESTED: ["SUBMITTED", "CANCELED"],
  SUBMITTED: ["PROCESSED", "FAILED", "CANCELED"],
  PROCESSED: [],
  FAILED: [],
  CANCELED: [],
};

const CHARGEBACK: Record<ChargebackStatus, readonly ChargebackStatus[]> = {
  OPEN: ["IN_PROCESS", "CLOSED"],
  IN_PROCESS: ["WON", "LOST", "CLOSED"],
  WON: ["CLOSED"],
  LOST: ["CLOSED"],
  CLOSED: [],
};

const SETTLEMENT: Record<SettlementStatus, readonly SettlementStatus[]> = {
  OPEN: ["CALCULATED", "CANCELED"],
  CALCULATED: ["APPROVED", "CANCELED"],
  APPROVED: ["PAID", "FAILED", "CANCELED"],
  PAID: [],
  FAILED: [],
  CANCELED: [],
};

function transition<S extends string>(
  entity: string,
  map: Record<S, readonly S[]>,
  from: S,
  to: S,
): S {
  const allowed = map[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(entity, from, to);
  }
  return to;
}

export function transitionPaymentIntent(
  from: PaymentIntentStatus,
  to: PaymentIntentStatus,
): PaymentIntentStatus {
  return transition("PaymentIntent", INTENT, from, to);
}

export function transitionPaymentOrder(
  from: PaymentOrderStatus,
  to: PaymentOrderStatus,
): PaymentOrderStatus {
  return transition("PaymentOrder", ORDER, from, to);
}

export function transitionSplitConsent(
  from: SplitConsentStatus,
  to: SplitConsentStatus,
): SplitConsentStatus {
  return transition("SplitConsent", CONSENT, from, to);
}

export function transitionRefund(from: RefundStatus, to: RefundStatus): RefundStatus {
  return transition("Refund", REFUND, from, to);
}

export function transitionChargeback(
  from: ChargebackStatus,
  to: ChargebackStatus,
): ChargebackStatus {
  return transition("Chargeback", CHARGEBACK, from, to);
}

export function transitionSettlement(
  from: SettlementStatus,
  to: SettlementStatus,
): SettlementStatus {
  return transition("Settlement", SETTLEMENT, from, to);
}

export function isTerminalIntent(status: PaymentIntentStatus): boolean {
  return INTENT[status].length === 0;
}
