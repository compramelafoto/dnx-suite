import type { StoreOrderPaymentStatus, StoreOrderStatus } from "./types";

const ORDER_TRANSITIONS: Record<StoreOrderStatus, readonly StoreOrderStatus[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "PAYMENT_FAILED", "EXPIRED", "CANCELLED"],
  PAID: ["READY_FOR_PICKUP", "SHIPPED", "REFUNDED"],
  PAYMENT_FAILED: ["PENDING_PAYMENT", "CANCELLED", "EXPIRED"],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
  READY_FOR_PICKUP: ["DELIVERED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: [],
};

const PAYMENT_TRANSITIONS: Record<
  StoreOrderPaymentStatus,
  readonly StoreOrderPaymentStatus[]
> = {
  CREATED: ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "UNKNOWN"],
  PENDING: ["APPROVED", "REJECTED", "CANCELLED", "REFUNDED", "CHARGED_BACK", "UNKNOWN"],
  APPROVED: ["REFUNDED", "CHARGED_BACK"],
  REJECTED: ["PENDING", "CANCELLED"],
  CANCELLED: [],
  REFUNDED: [],
  CHARGED_BACK: [],
  UNKNOWN: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
};

export function canTransitionStoreOrder(
  from: StoreOrderStatus,
  to: StoreOrderStatus,
): boolean {
  if (from === to) return true;
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertStoreOrderTransition(
  from: StoreOrderStatus,
  to: StoreOrderStatus,
): void {
  if (!canTransitionStoreOrder(from, to)) {
    throw new Error(`STORE_ORDER_INVALID_TRANSITION:${from}->${to}`);
  }
}

export function canTransitionStorePayment(
  from: StoreOrderPaymentStatus,
  to: StoreOrderPaymentStatus,
): boolean {
  if (from === to) return true;
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function assertStorePaymentTransition(
  from: StoreOrderPaymentStatus,
  to: StoreOrderPaymentStatus,
): void {
  if (!canTransitionStorePayment(from, to)) {
    throw new Error(`STORE_PAYMENT_INVALID_TRANSITION:${from}->${to}`);
  }
}
