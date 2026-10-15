import { CART_MAX_LINES, CART_SCHEMA_VERSION } from "./constants";
import { maxQtyForLine } from "./line-key";
import type { ArtworkCartLine, CartLine, CartState, ProductCartLine } from "./types";

// Validación a mano: no agregamos dependencias nuevas por esto. Nunca lanza.
function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function isNonEmptyStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function isNullableStr(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

/** Precio y cantidad válidos para una línea de esta clase; `null` si no. */
function priceAndQty(r: Record<string, unknown>, max: number): { unitPriceMinor: number; qty: number } | null {
  const price = r.unitPriceMinor;
  const qty = r.qty;
  if (typeof price !== "number" || !Number.isInteger(price) || price < 0) return null;
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > max) return null;
  return { unitPriceMinor: price, qty };
}

function parseProductLine(r: Record<string, unknown>): ProductCartLine | null {
  if (!isNonEmptyStr(r.productId)) return null;
  if (!isNullableStr(r.variantId) || !isStr(r.slug) || !isStr(r.name)) return null;
  if (!isNullableStr(r.variantName) || !isNullableStr(r.imageUrl)) return null;
  const pq = priceAndQty(r, maxQtyForLine({ kind: "product" }));
  if (!pq) return null;
  return {
    kind: "product",
    productId: r.productId,
    variantId: r.variantId,
    slug: r.slug,
    name: r.name,
    variantName: r.variantName,
    imageUrl: r.imageUrl,
    ...pq,
  };
}

function parseArtworkLine(r: Record<string, unknown>): ArtworkCartLine | null {
  if (!isNonEmptyStr(r.artworkListingId) || !isNonEmptyStr(r.printFormatId)) return null;
  if (!isStr(r.slug) || !isStr(r.title) || !isStr(r.formatName) || !isNullableStr(r.imageUrl)) return null;
  const pq = priceAndQty(r, maxQtyForLine({ kind: "artwork" }));
  if (!pq) return null;
  return {
    kind: "artwork",
    artworkListingId: r.artworkListingId,
    printFormatId: r.printFormatId,
    slug: r.slug,
    title: r.title,
    formatName: r.formatName,
    imageUrl: r.imageUrl,
    ...pq,
  };
}

function parseLine(raw: unknown): CartLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === "artwork") return parseArtworkLine(r);
  // Sin `kind`: un carrito guardado antes de que existieran las obras. Es un producto.
  if (r.kind === undefined || r.kind === "product") return parseProductLine(r);
  return null;
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
