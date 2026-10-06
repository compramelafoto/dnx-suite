import { CART_MAX_ARTWORK_QTY, CART_MAX_QTY } from "./constants";
import type { CartLine } from "./types";

/**
 * Lo mínimo para identificar una línea. Sin `kind` es un producto: así lo llaman también los
 * pedidos y las retenciones de stock, que sólo conocen producto y talle.
 */
export type LineKeyInput =
  | { kind?: "product"; productId: string; variantId: string | null }
  | { kind: "artwork"; artworkListingId: string; printFormatId: string };

/** Producto: `<productId>:<variantId|->` (sin cambios). Obra: `a:<artworkListingId>:<printFormatId>`. */
export function lineKey(l: LineKeyInput): string {
  if (l.kind === "artwork") return `a:${l.artworkListingId}:${l.printFormatId}`;
  return `${l.productId}:${l.variantId ?? "-"}`;
}

/** El tope de unidades de una línea: 99 para productos, 20 copias para una obra en un formato. */
export function maxQtyForLine(l: Pick<CartLine, "kind">): number {
  return l.kind === "artwork" ? CART_MAX_ARTWORK_QTY : CART_MAX_QTY;
}

/** Lo que se lee como nombre de la línea. */
export function cartLineName(l: CartLine): string {
  return l.kind === "artwork" ? l.title : l.name;
}

/** El detalle bajo el nombre: el talle o el formato de impresión. */
export function cartLineDetail(l: CartLine): string | null {
  if (l.kind === "artwork") return l.formatName;
  return l.variantName ? `Talle ${l.variantName}` : null;
}

/** La ficha de la línea dentro de la tienda (`base` = `/w/<slug>/tienda`). */
export function cartLineHref(base: string, l: CartLine): string {
  return l.kind === "artwork" ? `${base}/obras/${l.slug}` : `${base}/${l.slug}`;
}
