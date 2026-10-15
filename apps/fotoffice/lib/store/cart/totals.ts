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
