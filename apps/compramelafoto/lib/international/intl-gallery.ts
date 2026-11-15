import type { GalleryPricingSnapshot } from "@/lib/pricing/gallery-pricing-snapshot";
import { formatMoney } from "./money";
import { computeIntlDigitalTotals } from "./intl-order";

/** Precio de galería de un álbum internacional: precio por foto + 15 %, sin descuentos por cantidad. */
export function buildIntlGalleryPricing(unitPriceStored: number | null, currency: string): GalleryPricingSnapshot {
  if (!unitPriceStored || unitPriceStored <= 0) {
    return { kind: "SALES_NOT_READY", showBand: false, reason: "Sin precio digital" };
  }
  const clientUnit = computeIntlDigitalTotals({ unitPriceStored, photoCount: 1, currency }).totalStored;
  return {
    kind: "DIGITAL_UNIFORM",
    showBand: true,
    digitalUnitPriceArs: clientUnit,
    digitalUnitPriceLabel: formatMoney(clientUnit, currency),
    discountLabel: null,
    discounts: [],
    enablePrintedPhotos: false,
    digitalDiscount5Plus: null,
    digitalDiscount10Plus: null,
    digitalDiscount20Plus: null,
    currency,
  };
}

/** Ids de fotos de la URL de la compra internacional (`?fotos=1,2,3`), sin repetidos. */
export function parseIntlCheckoutPhotoIds(raw: string | null | undefined): number[] {
  const out: number[] = [];
  for (const part of (raw ?? "").split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}
