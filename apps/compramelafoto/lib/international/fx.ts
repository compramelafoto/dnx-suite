import { storedToMajor } from "./money";

/** Servicio público de cotizaciones: gratuito, sin clave, un valor por moneda. */
export const FX_SOURCE = "open.er-api.com";
export const FX_URL = "https://open.er-api.com/v6/latest/USD";
const STALE_MS = 48 * 60 * 60 * 1000;

/** Unidades locales que vale 1 USD, solo para las monedas pedidas con un número positivo. */
export function parseErApiRates(json: unknown, currencies: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!json || typeof json !== "object") return out;
  const body = json as { result?: unknown; rates?: Record<string, unknown> };
  if (body.result !== "success" || !body.rates || typeof body.rates !== "object") return out;
  for (const cur of currencies) {
    const v = body.rates[cur];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[cur] = v;
  }
  return out;
}

/** Valor de compra o de venta (regla 6.8 bis del diseño). */
export function pickRate(
  rate: { unitsPerUsdBuy: string; unitsPerUsdSell: string },
  side: "BUY" | "SELL",
): number {
  return Number(side === "BUY" ? rate.unitsPerUsdBuy : rate.unitsPerUsdSell);
}

/** Monto guardado en moneda local → centavos de USD, redondeado hacia arriba (a favor de DNX). */
export function localStoredToUsdCentsCeil(stored: number, currency: string, unitsPerUsd: number): number {
  const cents = (storedToMajor(stored, currency) / unitsPerUsd) * 100;
  // Evita que un error de coma flotante (37.0000001) sume un centavo de más.
  return Math.ceil(Math.round(cents * 1e6) / 1e6);
}

export function isStale(fetchedAt: Date, now: Date): boolean {
  return now.getTime() - fetchedAt.getTime() > STALE_MS;
}

/** Fecha YYYY-MM-DD en hora argentina. */
export function argentinaDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
