/**
 * Observe-only flag for Orders 1:N webhooks (10D3I-G).
 * Independent from create flag DNX_MP_ORDERS_1N_STAGING_ENABLED.
 * Default OFF. Never enables Checkout Pro cutover.
 */
export const ORDERS_1N_WEBHOOK_OBSERVE_FLAG =
  "DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED" as const;

export function isOrders1nWebhookObserveEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env[ORDERS_1N_WEBHOOK_OBSERVE_FLAG] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
