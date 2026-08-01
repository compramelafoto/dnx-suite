export type StoreCheckoutLogEvent =
  | "store_order_created"
  | "store_hold_created"
  | "store_payment_preference_created"
  | "store_payment_approved"
  | "store_payment_rejected"
  | "store_hold_captured"
  | "store_hold_released"
  | "store_order_expired"
  | "store_webhook_processed"
  | "store_webhook_duplicate"
  | "store_checkout_failed";

export function logStoreCheckoutEvent(
  event: StoreCheckoutLogEvent,
  meta: Record<string, unknown>,
): void {
  const safe: Record<string, unknown> = { event, ...meta };
  delete safe.email;
  delete safe.phone;
  delete safe.accessToken;
  delete safe.customerEmail;
  delete safe.customerPhone;
  console.info(JSON.stringify(safe));
}
