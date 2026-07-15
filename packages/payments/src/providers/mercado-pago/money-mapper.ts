import type { Money } from "../../money/types.js";
import { getCurrencyScale } from "./client/mercado-pago-environment.js";

/**
 * Converts Money (bigint minor units) to MP decimal amount string without floats.
 * Example: ARS 35000 minor (scale 2) => "350.00"
 */
export function moneyToMercadoPagoAmount(m: Money): string {
  const scale = getCurrencyScale(m.currency);
  const divisor = 10n ** BigInt(scale);
  const whole = m.amountMinor / divisor;
  const fraction = m.amountMinor % divisor;
  if (scale === 0) {
    return whole.toString();
  }
  const fractionStr = fraction.toString().padStart(scale, "0");
  return `${whole.toString()}.${fractionStr}`;
}

/**
 * Converts basis points to MP percentage string for split amounts.
 * In percentage mode, splits.amount values are percentage strings summing to 100.
 * Example: 1500 bps => "15.00" (15%)
 */
export function percentageBpsToMercadoPagoAmount(bps: number): string {
  if (!Number.isInteger(bps)) {
    throw new Error(`percentage bps must be integer, got ${bps}`);
  }
  if (bps < 0 || bps > 10_000) {
    throw new Error(`percentage bps out of range 0..10000: ${bps}`);
  }
  const whole = Math.floor(bps / 100);
  const fraction = bps % 100;
  return `${whole}.${fraction.toString().padStart(2, "0")}`;
}
