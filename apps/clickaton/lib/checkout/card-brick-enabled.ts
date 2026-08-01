import {
  isClickatonDnxCheckoutEnabled,
  isOrders1nStagingFlagEnabled,
  resolveClickatonPaymentsProviderMode,
} from "@repo/payments/next";

/**
 * Card Payment Brick is only offered for Orders 1:N TEST behind existing flags.
 * Never enables production writes by itself.
 */
export function isClickatonCardBrickCheckoutEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const provider = resolveClickatonPaymentsProviderMode(
    (env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual").trim(),
  );
  return (
    provider === "mercado_pago_orders_test" &&
    isClickatonDnxCheckoutEnabled(env) &&
    isOrders1nStagingFlagEnabled(env)
  );
}

/** Public key for Brick — browser-safe. Never access token. */
export function resolveClickatonMercadoPagoPublicKey(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const fromPublic = env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim();
  if (fromPublic) return fromPublic;
  const fromTest = env.MERCADOPAGO_TEST_PUBLIC_KEY?.trim();
  if (fromTest) return fromTest;
  return null;
}
