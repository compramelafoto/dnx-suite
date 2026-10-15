/** Cuánto se puede vender online. Módulo PURO. `null` = sin límite (no controla stock). */
export function availableQty(input: { stockQty: number; tracksStock: boolean; reservedQty: number }): number | null {
  if (!input.tracksStock) return null;
  return Math.max(0, input.stockQty - input.reservedQty);
}

/** El precio de la variante manda cuando existe; si no, el del producto. */
export function effectiveUnitPriceMinor(productPriceMinor: number, variantPriceMinor: number | null): number {
  return variantPriceMinor ?? productPriceMinor;
}
