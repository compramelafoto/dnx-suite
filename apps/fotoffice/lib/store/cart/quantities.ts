import { CART_MAX_QTY } from "./constants";

/** Entero entre 1 y `max` (por omisión CART_MAX_QTY). Lo inválido (NaN, infinito) queda en 1. */
export function clampQty(n: number, max: number = CART_MAX_QTY): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(max, Math.max(1, Math.floor(n)));
}
