import { computeBundleDiscount, type ClientBundle } from "../bundle";
import type { CartState } from "./types";

export function cartTotals(state: CartState): { itemsCount: number; subtotalMinor: number } {
  let itemsCount = 0;
  let subtotalMinor = 0;
  for (const l of state.lines) {
    itemsCount += l.qty;
    subtotalMinor += l.qty * l.unitPriceMinor;
  }
  return { itemsCount, subtotalMinor };
}

/**
 * El descuento de la promo "N por $X" sobre el carrito, para mostrar. Sólo productos de la promo
 * (nunca obras). El servidor lo vuelve a calcular con sus precios al crear el pedido.
 */
export function cartBundleDiscount(state: CartState, bundle: ClientBundle | null): number {
  if (!bundle) return 0;
  const elegibles = new Set(bundle.productIds);
  return computeBundleDiscount(
    bundle,
    state.lines.filter((l) => l.kind === "product" && elegibles.has(l.productId)),
  ).discountMinor;
}
