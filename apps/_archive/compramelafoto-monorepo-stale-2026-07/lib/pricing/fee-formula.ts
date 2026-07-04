/**
 * Fórmula única del fee de plataforma en TODAS las calculadoras y ventas:
 *
 * El fee es el % que se SUMÓ al precio base (lo que cobra el fotógrafo).
 * Si base = 1000 y % = 15 → cliente paga 1150, fee = 150 (no 15% de 1150 = 172,5).
 *
 * - total = base * (1 + percent/100)
 * - fee = base * percent/100 = total * percent/(100+percent)
 */

/**
 * Fee en centavos a partir del total que paga el cliente.
 * total = base + fee, fee = total * percent/(100+percent)
 */
export function feeFromTotal(totalCents: number, percent: number): number {
  if (!Number.isFinite(totalCents) || totalCents <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round(totalCents * (percent / (100 + percent)));
}

/**
 * Precio base (lo que cobra el fotógrafo) a partir del total que paga el cliente.
 * base = total * 100/(100+percent)
 */
export function baseFromTotal(totalCents: number, percent: number): number {
  if (!Number.isFinite(totalCents) || totalCents <= 0) return 0;
  if (!Number.isFinite(percent) || percent < 0) return 0;
  return Math.round(totalCents * (100 / (100 + percent)));
}

/**
 * Fee en centavos a partir del precio base (lo que cobra el fotógrafo).
 * fee = base * percent/100
 */
export function feeFromBase(baseCents: number, percent: number): number {
  if (!Number.isFinite(baseCents) || baseCents <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round(baseCents * (percent / 100));
}

/**
 * Total que paga el cliente a partir del precio base.
 * total = base * (1 + percent/100)
 */
export function totalFromBase(baseCents: number, percent: number): number {
  if (!Number.isFinite(baseCents) || baseCents <= 0) return 0;
  if (!Number.isFinite(percent) || percent < 0) return baseCents;
  return Math.round(baseCents * (1 + percent / 100));
}
