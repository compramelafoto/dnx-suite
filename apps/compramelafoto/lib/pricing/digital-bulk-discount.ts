export type DigitalBulkDiscountTier = {
  minQuantity: number;
  percent: number;
};

export type DigitalBulkDiscountInput = {
  digitalDiscount5Plus?: number | null;
  digitalDiscount10Plus?: number | null;
  digitalDiscount20Plus?: number | null;
};

function normalizeTierPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(100, Math.round(value));
}

export function buildStructuredDigitalDiscounts(
  discounts: DigitalBulkDiscountInput | null | undefined
): DigitalBulkDiscountTier[] {
  if (!discounts) return [];
  const tiers: DigitalBulkDiscountTier[] = [];
  const d5 = normalizeTierPercent(discounts.digitalDiscount5Plus);
  const d10 = normalizeTierPercent(discounts.digitalDiscount10Plus);
  const d20 = normalizeTierPercent(discounts.digitalDiscount20Plus);
  if (d5 != null) tiers.push({ minQuantity: 5, percent: d5 });
  if (d10 != null) tiers.push({ minQuantity: 10, percent: d10 });
  if (d20 != null) tiers.push({ minQuantity: 20, percent: d20 });
  return tiers;
}

/** Misma lógica que `ComprarClient` para descuentos por cantidad en digitales. */
export function getDigitalBulkDiscountPercent(
  qty: number,
  discounts: DigitalBulkDiscountInput | null | undefined
): number {
  if (!discounts || qty <= 0) return 0;
  const d20 = Number(discounts.digitalDiscount20Plus ?? 0);
  const d10 = Number(discounts.digitalDiscount10Plus ?? 0);
  const d5 = Number(discounts.digitalDiscount5Plus ?? 0);
  if (qty >= 20 && Number.isFinite(d20) && d20 > 0) return Math.min(100, Math.max(0, d20));
  if (qty >= 10 && Number.isFinite(d10) && d10 > 0) return Math.min(100, Math.max(0, d10));
  if (qty >= 5 && Number.isFinite(d5) && d5 > 0) return Math.min(100, Math.max(0, d5));
  return 0;
}

/** Etiqueta de beneficios para la banda de galería (`5+ fotos: 5% OFF · …`). */
export function buildDigitalBulkDiscountBenefitsLabel(
  discounts: DigitalBulkDiscountInput | null | undefined
): string | null {
  if (!discounts) return null;
  const parts: string[] = [];
  const d5 = normalizeTierPercent(discounts.digitalDiscount5Plus);
  const d10 = normalizeTierPercent(discounts.digitalDiscount10Plus);
  const d20 = normalizeTierPercent(discounts.digitalDiscount20Plus);
  if (d5 != null) parts.push(`5+ fotos: ${d5}% OFF`);
  if (d10 != null) parts.push(`10+ fotos: ${d10}% OFF`);
  if (d20 != null) parts.push(`20+ fotos: ${d20}% OFF`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
