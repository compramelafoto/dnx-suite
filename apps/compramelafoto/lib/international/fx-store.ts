import { prisma } from "@/lib/prisma";
import { SUPPORTED_COUNTRIES } from "./countries";
import { FX_SOURCE, FX_URL, argentinaDate, parseErApiRates } from "./fx";

/** Monedas que hoy se venden con el Mercado Pago del fotógrafo. */
export function intlMpCurrencies(): string[] {
  return [...new Set(SUPPORTED_COUNTRIES.filter((c) => c.provider === "MERCADOPAGO_OWN").map((c) => c.currency))];
}

/** Trae y guarda la cotización del día. Repetirlo el mismo día actualiza la fila. */
export async function refreshFxRates(
  fetchImpl: typeof fetch = fetch,
): Promise<{ saved: string[]; missing: string[] }> {
  const currencies = intlMpCurrencies();
  const res = await fetchImpl(FX_URL, { signal: AbortSignal.timeout(15_000) });
  const json = res.ok ? await res.json().catch(() => null) : null;
  const rates = parseErApiRates(json, currencies);
  const effectiveDate = argentinaDate(new Date());
  const saved: string[] = [];
  for (const [currency, value] of Object.entries(rates)) {
    const v = String(value);
    await prisma.clfFxRate.upsert({
      where: { currency_effectiveDate_source: { currency, effectiveDate, source: FX_SOURCE } },
      create: { currency, effectiveDate, source: FX_SOURCE, unitsPerUsdBuy: v, unitsPerUsdSell: v },
      update: { unitsPerUsdBuy: v, unitsPerUsdSell: v, fetchedAt: new Date() },
    });
    saved.push(currency);
  }
  return { saved, missing: currencies.filter((c) => !saved.includes(c)) };
}

/** Última cotización guardada de la moneda, sin importar la fecha. */
export function latestFxRate(currency: string) {
  return prisma.clfFxRate.findFirst({ where: { currency }, orderBy: { fetchedAt: "desc" } });
}
