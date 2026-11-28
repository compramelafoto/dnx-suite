/**
 * «Agregar producto» a un pedido ya tomado: la parte PURA (ver `./agregar-item.ts`).
 */

import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { aCentavos, desdeCentavos } from "./plan-cuotas";

/** Prefijo de la clave de un renglón agregado después (no es `cargo-`: cuenta como un ítem más). */
export const PREFIJO_ITEM_AGREGADO = "ag-";

/** La clave del renglón sale de la clave del pedido de agregado: el mismo pedido dos veces suma uno. */
export const claveDeItemAgregado = (clave: string): string => `${PREFIJO_ITEM_AGREGADO}${clave}`;

/** Lo que vale el renglón (cantidad × precio, en pesos con dos decimales). Sin descuento. */
export function netoDelItem(i: Pick<ItemPresupuesto, "cantidad" | "precioUnitario">): number {
  return desdeCentavos(Math.round(i.cantidad * aCentavos(i.precioUnitario)));
}

/**
 * Los ítems tal como se guardan, con todos los demás marcados opcionales: así las reglas de
 * trabajos y citas corren sólo para el renglón nuevo (`indice`), pero con su posición real (la que
 * queda en `pedidoItemIndex`). Un renglón viejo cuya regla se destildó al confirmar no revive.
 */
export function itemsParaElAgregado<T extends { opcional?: boolean }>(items: readonly T[], indice: number): T[] {
  return items.map((it, i) => (i === indice ? it : { ...it, opcional: true }));
}
