import { Prisma } from "@repo/db";

/**
 * Comisión de la plataforma, en puntos básicos (bps): 500 = 5%.
 *
 * Se guardan enteros y no porcentajes decimales por la misma razón por la que el dinero
 * no se guarda en coma flotante: 5,25% es 525, un entero exacto, y no 5.25 con su cola
 * binaria. `@repo/payments` ya usa esta convención (`commissionOverrideBps`).
 */
export const DEFAULT_PLATFORM_FEE_BPS = 500;
export const MAX_PLATFORM_FEE_BPS = 10000;

/** Un bps válido es entero y está entre 0 y 10000 inclusive. El 0 es legítimo. */
export function isValidFeeBps(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_PLATFORM_FEE_BPS
  );
}

/**
 * Resuelve la comisión efectiva.
 *
 * Un valor fuera de rango cae al default en lugar de propagarse: una comisión corrupta
 * en la base no puede traducirse en un cobro corrupto. `0` NO es "sin configurar" —
 * es una comisión de cero, y se respeta.
 */
export function resolvePlatformFeeBps(configured?: number | null): number {
  return isValidFeeBps(configured) ? configured : DEFAULT_PLATFORM_FEE_BPS;
}

/** "5%", "10,5%" — coma decimal, que es lo que se usa en español. */
export function formatFeeBpsAsPercent(bps: number): string {
  const percent = new Prisma.Decimal(bps).div(100);
  const text = percent.toDecimalPlaces(2).toString();
  return `${text.replace(".", ",")}%`;
}

export type FeeSplit = {
  total: Prisma.Decimal;
  fee: Prisma.Decimal;
  net: Prisma.Decimal;
  feeBps: number;
};

/**
 * Parte un monto en comisión y neto.
 *
 * El fee se descuenta del total: quien paga abona `total`, no `total + fee`.
 *
 * El neto se calcula **restando**, nunca multiplicando por el complemento. Multiplicar
 * dos veces y redondear dos veces produce sumas que no cierran contra el total, y eso
 * es plata que aparece o desaparece.
 */
export function splitByPlatformFee(total: Prisma.Decimal, feeBps: number): FeeSplit {
  const bps = resolvePlatformFeeBps(feeBps);
  const fee = total
    .mul(bps)
    .div(MAX_PLATFORM_FEE_BPS)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { total, fee, net: total.minus(fee), feeBps: bps };
}
