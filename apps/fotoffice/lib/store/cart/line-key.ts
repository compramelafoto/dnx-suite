import type { CartLine } from "./types";

export function lineKey(l: Pick<CartLine, "productId" | "variantId">): string {
  return `${l.productId}:${l.variantId ?? "-"}`;
}
