/**
 * Fórmula única para precios de impresión:
 * 1) basePrice: precio base unitario (origen: PhotographerProduct o futuro Lab)
 * 2) priceAfterAlbumMargin = basePrice * (1 + albumMarginPercent/100)
 * 3) finalUnitPrice = priceAfterAlbumMargin * (1 + platformFeePercent/100)
 * 4) total = finalUnitPrice * quantity
 * El fee de plataforma NUNCA se aplica antes del margen del álbum.
 */

import { getAppConfig } from "@/lib/services/settingsService";

export type PrintPricingBreakdown = {
  baseUnitPrice: number;
  albumMarginPercent: number;
  priceAfterAlbumMargin: number;
  platformFeePercent: number;
  platformFeeAmountPerUnit: number;
  finalUnitPrice: number;
  quantity: number;
  subtotal: number;
};

/**
 * Obtiene el % de comisión de plataforma desde AppConfig (para impresiones).
 * Cache interno vía getAppConfig.
 */
export async function getPlatformFeePercent(): Promise<number> {
  const config = await getAppConfig();
  const raw = config?.platformCommissionPercent;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw);
  }
  return 10;
}

/**
 * Cálculo puro del desglose de impresión.
 * Valores de dinero en Int (ARS, sin centavos).
 * Redondeo: por unidad (finalUnitPrice) y luego subtotal = finalUnitPrice * quantity.
 */
export function computePrintPricing(params: {
  baseUnitPrice: number;
  albumMarginPercent: number;
  platformFeePercent: number;
  quantity: number;
}): PrintPricingBreakdown {
  const baseUnitPrice = Math.round(Number(params.baseUnitPrice) || 0);
  const albumMarginPercent = Number(params.albumMarginPercent) || 0;
  const platformFeePercent = Number(params.platformFeePercent) || 0;
  const quantity = Math.max(1, Math.round(Number(params.quantity) || 1));

  // 1) Precio después del margen del álbum (obra)
  const priceAfterAlbumMargin = Math.round(
    baseUnitPrice * (1 + albumMarginPercent / 100)
  );

  // 2) Precio final unitario (cliente): incluye fee plataforma sobre precio obra
  const finalUnitPrice = Math.round(
    priceAfterAlbumMargin * (1 + platformFeePercent / 100)
  );

  const platformFeeAmountPerUnit = finalUnitPrice - priceAfterAlbumMargin;
  const subtotal = finalUnitPrice * quantity;

  return {
    baseUnitPrice,
    albumMarginPercent,
    priceAfterAlbumMargin,
    platformFeePercent,
    platformFeeAmountPerUnit,
    finalUnitPrice,
    quantity,
    subtotal,
  };
}
