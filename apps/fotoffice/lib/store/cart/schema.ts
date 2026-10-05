import { CART_MAX_LINES, CART_MAX_QTY, CART_SCHEMA_VERSION } from "./constants";
import type { CartLine, CartState } from "./types";

// Validación a mano: no agregamos dependencias nuevas por esto. Nunca lanza.
function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function isNullableStr(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

function parseLine(raw: unknown): CartLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isStr(r.productId) || r.productId.length === 0) return null;
  if (!isNullableStr(r.variantId) || !isStr(r.slug) || !isStr(r.name)) return null;
  if (!isNullableStr(r.variantName) || !isNullableStr(r.imageUrl)) return null;
  const price = r.unitPriceMinor;
  const qty = r.qty;
  if (typeof price !== "number" || !Number.isInteger(price) || price < 0) return null;
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > CART_MAX_QTY) return null;
  return {
    productId: r.productId,
    variantId: r.variantId,
    slug: r.slug,
    name: r.name,
    variantName: r.variantName,
    imageUrl: r.imageUrl,
    unitPriceMinor: price,
    qty,
  };
}

/** Devuelve el carrito si es válido; si algo no cierra, un carrito vacío. */
export function parseCartState(raw: unknown): CartState {
  const empty: CartState = { version: CART_SCHEMA_VERSION, lines: [] };
  if (typeof raw !== "object" || raw === null) return empty;
  const r = raw as Record<string, unknown>;
  if (r.version !== CART_SCHEMA_VERSION || !Array.isArray(r.lines)) return empty;
  if (r.lines.length > CART_MAX_LINES) return empty;
  const lines: CartLine[] = [];
  for (const item of r.lines) {
    const l = parseLine(item);
    if (!l) return empty;
    lines.push(l);
  }
  return { version: CART_SCHEMA_VERSION, lines };
}
