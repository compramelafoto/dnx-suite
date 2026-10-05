import { CART_MAX_QTY } from "./constants";

/** Entero entre 1 y CART_MAX_QTY. Lo inválido (NaN, infinito) queda en 1. */
export function clampQty(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(CART_MAX_QTY, Math.max(1, Math.floor(n)));
}
