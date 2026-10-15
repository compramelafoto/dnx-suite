import { z } from "zod";
import { CART_MAX_LINES, CART_MAX_QTY } from "./cart/constants";
import type { CartLineInput } from "./storefront";

/**
 * Lo que manda el navegador para revalidar el carrito. Módulo PURO. Viene de `localStorage`, o
 * sea de cualquiera: se valida la forma y se descarta todo lo que no se usa. El precio y el nombre
 * sólo sirven para avisar si algo cambió; nunca se cobra con ellos.
 *
 * Una línea sin `kind` es un producto (los carritos de antes de las obras). Las obras admiten acá
 * hasta 99 como los productos: el tope de 20 copias lo aplica el servidor con un aviso, en vez de
 * rechazar el carrito entero.
 */
const precioYNombre = {
  qty: z.number().int().min(1).max(CART_MAX_QTY),
  unitPriceMinor: z.number().int().min(0).optional(),
  name: z.string().max(200).optional(),
};

const producto = z.object({
  kind: z.literal("product").optional(),
  productId: z.string().min(1).max(64),
  variantId: z.string().min(1).max(64).nullable(),
  ...precioYNombre,
});

const obra = z.object({
  kind: z.literal("artwork"),
  artworkListingId: z.string().min(1).max(64),
  printFormatId: z.string().min(1).max(64),
  ...precioYNombre,
});

const schema = z.array(z.union([obra, producto])).max(CART_MAX_LINES);

/** `null` si no tiene la forma de un carrito. */
export function parseCartLinesInput(raw: unknown): CartLineInput[] | null {
  const r = schema.safeParse(raw);
  return r.success ? r.data : null;
}
