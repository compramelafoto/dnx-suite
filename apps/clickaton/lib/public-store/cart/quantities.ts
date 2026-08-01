import { STORE_CART_MAX_QUANTITY_PER_LINE } from "@/lib/public-store/cart/constants";

export type QuantityClampResult = {
  ok: boolean;
  quantity: number;
  reason?:
    | "not_integer"
    | "below_min"
    | "above_max"
    | "above_stock"
    | "invalid";
};

/**
 * Normaliza cantidad entera ≥ 1.
 * maxEffective = min(stockPublico, STORE_CART_MAX_QUANTITY_PER_LINE) cuando stock es conocido.
 */
export function clampStoreCartQuantity(input: {
  quantity: unknown;
  availableStock?: number | null;
  maxPerLine?: number;
}): QuantityClampResult {
  const maxPerLine = input.maxPerLine ?? STORE_CART_MAX_QUANTITY_PER_LINE;
  const stock =
    input.availableStock == null || !Number.isFinite(input.availableStock)
      ? null
      : Math.max(0, Math.floor(input.availableStock));

  const maxEffective =
    stock == null ? maxPerLine : Math.min(maxPerLine, stock);

  if (typeof input.quantity === "string" && input.quantity.trim() === "") {
    return { ok: false, quantity: 1, reason: "invalid" };
  }

  const n =
    typeof input.quantity === "number"
      ? input.quantity
      : typeof input.quantity === "string"
        ? Number(input.quantity.trim())
        : Number.NaN;

  if (!Number.isFinite(n)) {
    return { ok: false, quantity: 1, reason: "invalid" };
  }
  if (!Number.isInteger(n)) {
    return { ok: false, quantity: 1, reason: "not_integer" };
  }
  if (n < 1) {
    return { ok: false, quantity: 1, reason: "below_min" };
  }
  if (stock !== null && stock <= 0) {
    return { ok: false, quantity: 1, reason: "above_stock" };
  }
  if (n > maxEffective) {
    return {
      ok: false,
      quantity: Math.max(1, maxEffective),
      reason: stock != null && n > stock ? "above_stock" : "above_max",
    };
  }
  return { ok: true, quantity: n };
}

export function maxStoreCartQuantity(availableStock: number): number {
  return Math.max(
    0,
    Math.min(STORE_CART_MAX_QUANTITY_PER_LINE, Math.floor(availableStock)),
  );
}

export function sumStoreCartUnits(
  items: readonly { quantity: number }[],
): number {
  return items.reduce((acc, item) => {
    const q = Number.isInteger(item.quantity) ? Math.max(0, item.quantity) : 0;
    return acc + q;
  }, 0);
}
