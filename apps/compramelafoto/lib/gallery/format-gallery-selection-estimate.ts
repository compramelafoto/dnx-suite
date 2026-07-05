import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import {
  getDigitalBulkDiscountPercent,
  type DigitalBulkDiscountInput,
} from "@/lib/pricing/digital-bulk-discount";
import type { GalleryPricingSnapshot } from "@/lib/pricing/gallery-pricing-snapshot";

export type GallerySelectionEstimate = {
  selectedCount: number;
  selectedCountLabel: string;
  discountPercent: number;
  discountAppliedLabel: string | null;
  totalArs: number;
  estimatedTotalLabel: string;
};

export function estimateUniformDigitalTotalArs(
  unitPriceArs: number,
  quantity: number,
  discounts: DigitalBulkDiscountInput | null | undefined
): { totalArs: number; discountPercent: number } {
  const qty = Math.max(0, Math.round(quantity));
  if (qty <= 0 || unitPriceArs <= 0) {
    return { totalArs: 0, discountPercent: 0 };
  }
  const discountPercent = getDigitalBulkDiscountPercent(qty, discounts);
  const subtotal = unitPriceArs * qty;
  const totalArs = Math.round(subtotal * (1 - discountPercent / 100));
  return { totalArs, discountPercent };
}

/**
 * Total estimado digital para galería (solo `DIGITAL_UNIFORM`).
 * No modifica el checkout; es orientativo para el comprador.
 */
export function buildGallerySelectionEstimate(
  galleryPricing: GalleryPricingSnapshot | null | undefined,
  selectedCount: number
): GallerySelectionEstimate | null {
  if (
    !galleryPricing ||
    galleryPricing.kind !== "DIGITAL_UNIFORM" ||
    selectedCount <= 0
  ) {
    return null;
  }

  const { totalArs, discountPercent } = estimateUniformDigitalTotalArs(
    galleryPricing.digitalUnitPriceArs,
    selectedCount,
    galleryPricing
  );

  const selectedCountLabel = `${selectedCount} foto${selectedCount === 1 ? "" : "s"} seleccionada${selectedCount === 1 ? "" : "s"}`;

  return {
    selectedCount,
    selectedCountLabel,
    discountPercent,
    discountAppliedLabel:
      discountPercent > 0 ? `${discountPercent}% OFF aplicado` : null,
    totalArs,
    estimatedTotalLabel: `Total digital estimado: ${formatPurchaseArs(totalArs)}`,
  };
}

/** Línea única (legacy inline). */
export function formatGallerySelectionEstimateLine(
  galleryPricing: GalleryPricingSnapshot | null | undefined,
  selectedCount: number
): string | null {
  const estimate = buildGallerySelectionEstimate(galleryPricing, selectedCount);
  if (!estimate) return null;

  if (estimate.discountPercent > 0) {
    return `${estimate.selectedCountLabel} · ${estimate.discountAppliedLabel} · ${estimate.estimatedTotalLabel}`;
  }

  return `${estimate.selectedCountLabel} · ${estimate.estimatedTotalLabel}`;
}

/** Total compacto para botones del visor (solo DIGITAL_UNIFORM con selección). */
export function formatGallerySelectionButtonTotal(
  galleryPricing: GalleryPricingSnapshot | null | undefined,
  selectedCount: number
): string | null {
  const estimate = buildGallerySelectionEstimate(galleryPricing, selectedCount);
  if (!estimate) return null;
  return formatPurchaseArs(estimate.totalArs);
}
