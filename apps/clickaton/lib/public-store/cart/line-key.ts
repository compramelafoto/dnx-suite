import { STORE_CART_DEFAULT_VARIANT_KEY } from "@/lib/public-store/cart/constants";

/** Identidad estable productId + variantId. */
export function storeCartLineKey(
  productId: string,
  variantId: string | null | undefined,
): string {
  const v =
    variantId == null || variantId === ""
      ? STORE_CART_DEFAULT_VARIANT_KEY
      : variantId.trim();
  return `${productId.trim()}::${v}`;
}

export function parseStoreCartLineKey(lineKey: string): {
  productId: string;
  variantId: string | null;
} {
  const idx = lineKey.indexOf("::");
  if (idx <= 0) {
    return { productId: lineKey, variantId: null };
  }
  const productId = lineKey.slice(0, idx);
  const raw = lineKey.slice(idx + 2);
  if (!raw || raw === STORE_CART_DEFAULT_VARIANT_KEY) {
    return { productId, variantId: null };
  }
  return { productId, variantId: raw };
}
