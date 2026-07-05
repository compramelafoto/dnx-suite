import { feeFromBase, feeFromTotal, totalFromBase } from "@/lib/pricing/fee-formula";
import { resolveAlbumOrderDigitalMarketplaceFeePercent } from "@/lib/pricing/album-order-digital-fee";

export type ClientDigitalPackPricing = {
  basePriceArs: number;
  marketplaceFeePercent: number;
  marketplaceFeeArs: number;
  clientPriceArs: number;
};

function normalizeBaseArs(value: number): number {
  return Math.max(0, Math.round(Number(value) || 0));
}

function normalizePercent(value: number): number {
  const pct = Number(value);
  if (!Number.isFinite(pct) || pct < 0) return 0;
  return Math.min(100, Math.round(pct));
}

/**
 * % fee marketplace para precios cliente digitales (fotos, packs, preventa, upsells).
 * Delega en `resolveAlbumOrderDigitalMarketplaceFeePercent` (override → lab → digital bps → legacy).
 */
export async function resolveClientMarketplaceFeePercent(params: {
  photographerId?: number | null;
  labId?: number | null;
}): Promise<number> {
  return resolveAlbumOrderDigitalMarketplaceFeePercent(params);
}

/** Precio que paga el cliente (ARS enteros) a partir del precio base del fotógrafo. */
export function clientTotalFromPhotographerBaseArs(
  photographerBaseArs: number,
  marketplaceFeePercent: number
): number {
  const base = normalizeBaseArs(photographerBaseArs);
  const pct = normalizePercent(marketplaceFeePercent);
  if (pct <= 0) return base;
  return Math.max(0, Math.round(totalFromBase(base * 100, pct) / 100));
}

/** Fee plataforma (ARS enteros) a partir del precio base del fotógrafo. */
export function platformFeeFromPhotographerBaseArs(
  photographerBaseArs: number,
  marketplaceFeePercent: number
): number {
  const base = normalizeBaseArs(photographerBaseArs);
  const pct = normalizePercent(marketplaceFeePercent);
  if (pct <= 0 || base <= 0) return 0;
  return Math.max(0, Math.round(feeFromBase(base * 100, pct) / 100));
}

/** Fee plataforma (ARS enteros) a partir del total que paga el cliente. */
export function platformFeeFromClientTotalArs(
  clientTotalArs: number,
  marketplaceFeePercent: number
): number {
  const total = normalizeBaseArs(clientTotalArs);
  const pct = normalizePercent(marketplaceFeePercent);
  if (pct <= 0 || total <= 0) return 0;
  return Math.max(0, Math.round(feeFromTotal(total * 100, pct) / 100));
}

export function buildClientDigitalPackPricing(
  photographerBaseArs: number,
  marketplaceFeePercent: number
): ClientDigitalPackPricing {
  const basePriceArs = normalizeBaseArs(photographerBaseArs);
  const marketplaceFeePercentNormalized = normalizePercent(marketplaceFeePercent);
  const clientPriceArs = clientTotalFromPhotographerBaseArs(
    basePriceArs,
    marketplaceFeePercentNormalized
  );
  const marketplaceFeeArs = platformFeeFromPhotographerBaseArs(
    basePriceArs,
    marketplaceFeePercentNormalized
  );
  return {
    basePriceArs,
    marketplaceFeePercent: marketplaceFeePercentNormalized,
    marketplaceFeeArs,
    clientPriceArs,
  };
}

export function mapPackRowToClientDigitalPricing<
  T extends { id: number; name: string; priceClientArs: number },
>(pack: T, marketplaceFeePercent: number) {
  const pricing = buildClientDigitalPackPricing(pack.priceClientArs, marketplaceFeePercent);
  return {
    id: pack.id,
    name: pack.name,
    ...pricing,
    /** Alias legacy para consumidores que esperaban `priceArs` = total cliente. */
    priceArs: pricing.clientPriceArs,
  };
}
