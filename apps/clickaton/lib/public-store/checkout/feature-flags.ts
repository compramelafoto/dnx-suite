/**
 * Feature flags TIENDA checkout / pagos.
 * Seguro por defecto: ausente o inválido → false.
 */

function envTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Checkout técnico (formulario + creación de orden). Default OFF. */
export function isStoreCheckoutEnabled(): boolean {
  return envTruthy(process.env.CLICKATON_STORE_CHECKOUT_ENABLED);
}

/**
 * Pagos live de tienda (MP producción). Default OFF.
 * Independiente del checkout técnico / sandbox.
 */
export function isStorePaymentsLiveEnabled(): boolean {
  return envTruthy(process.env.CLICKATON_STORE_PAYMENTS_LIVE);
}

/** TTL de hold en minutos. Default 15. */
export function storeHoldTtlMinutes(): number {
  const raw = process.env.STORE_HOLD_TTL_MINUTES?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 15;
  if (!Number.isFinite(n) || n < 5 || n > 120) return 15;
  return n;
}

export function storeCheckoutFlagsSummary(): {
  checkoutEnabled: boolean;
  paymentsLive: boolean;
  holdTtlMinutes: number;
} {
  return {
    checkoutEnabled: isStoreCheckoutEnabled(),
    paymentsLive: isStorePaymentsLiveEnabled(),
    holdTtlMinutes: storeHoldTtlMinutes(),
  };
}
