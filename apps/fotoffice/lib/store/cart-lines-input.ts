import { z } from "zod";
import { CART_MAX_LINES, CART_MAX_QTY } from "./cart/constants";
import type { CartLineInput } from "./storefront";

/**
 * Lo que manda el navegador para revalidar el carrito. Módulo PURO. Viene de `localStorage`, o
 * sea de cualquiera: se valida la forma y se descarta todo lo que no se usa. El precio y el nombre
 * sólo sirven para avisar si algo cambió; nunca se cobra con ellos.
 */
const schema = z
  .array(
    z.object({
      productId: z.string().min(1).max(64),
      variantId: z.string().min(1).max(64).nullable(),
      qty: z.number().int().min(1).max(CART_MAX_QTY),
      unitPriceMinor: z.number().int().min(0).optional(),
      name: z.string().max(200).optional(),
    }),
  )
  .max(CART_MAX_LINES);

/** `null` si no tiene la forma de un carrito. */
export function parseCartLinesInput(raw: unknown): CartLineInput[] | null {
  const r = schema.safeParse(raw);
  return r.success ? r.data : null;
}
