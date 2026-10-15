/**
 * Recargo de logística sobre el precio base del envío. Módulo PURO.
 *
 * PERCENT: `value` en puntos básicos (1000 = 10 %). FIXED: `value` en centavos.
 */

export type Surcharge = { kind: "NONE" | "PERCENT" | "FIXED"; value: number };

export function applySurcharge(baseMinor: number, surcharge: Surcharge): number {
  let total = baseMinor;
  if (surcharge.kind === "PERCENT") total = baseMinor + Math.round((baseMinor * surcharge.value) / 10000);
  else if (surcharge.kind === "FIXED") total = baseMinor + surcharge.value;
  return Math.max(0, total);
}
