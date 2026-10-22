/**
 * Cargos extra de un pedido (spec 2026-10-22, E6), la parte PURA: el renglón que se suma a
 * `items` y cómo cambian los `totals` guardados. Sin base y sin reloj.
 *
 * Un cargo es un renglón de texto libre (sin producto), cantidad 1, precio de lista y sin
 * descuento, que se agrega AL FINAL de los ítems: así los índices de los ítems originales (los que
 * usan los trabajos en `pedidoItemIndex`) no se mueven. Los totales se tocan sumando, no se
 * recalculan: un descuento global en porcentaje del pedido no alcanza al cargo, y el "ajuste por
 * forma de pago" (total del pedido − total de los ítems) queda igual.
 */

import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { MAX_ITEMS_VERSION, MAX_NOMBRE_ITEM } from "@/lib/presupuestos/constantes";
import { aCentavos, desdeCentavos } from "./plan-cuotas";

/** Prefijo de la clave del renglón de un cargo: `cargo-<id de la cuota>`. */
export const PREFIJO_ITEM_CARGO = "cargo-";

export const itemDeCargo = (cuotaId: string): string => `${PREFIJO_ITEM_CARGO}${cuotaId}`;

/** El renglón tal como se guarda en el JSON `items` (mismo formato que el alta), más su origen. */
export type ItemCargo = ItemPresupuesto & { origen: string };

export function armarItemCargo(a: { cuotaId: string; concepto: string; montoArs: number; origen: string }): ItemCargo {
  return {
    id: itemDeCargo(a.cuotaId),
    productId: null,
    nombre: a.concepto.trim().slice(0, MAX_NOMBRE_ITEM),
    descripcion: null,
    cantidad: 1,
    precioUnitario: desdeCentavos(aCentavos(a.montoArs)),
    descuento: null,
    modoPrecio: "LISTA",
    calculo: null,
    seccion: null,
    opcional: false,
    origen: a.origen,
  };
}

/** ¿Se puede sumar otro renglón sin que `validarItems` descarte la lista entera al leerla? */
export function hayLugarParaOtroItem(items: unknown): boolean {
  return !Array.isArray(items) || items.length < MAX_ITEMS_VERSION;
}

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);
const numeroFinito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Los totales guardados con el cargo sumado (`signo` 1) o quitado (`signo` −1). Sólo toca lo que ya
 * es número: un pedido migrado con `totals` vacío sigue vacío (y sin "ajuste"). El renglón del cargo
 * se agrega o se quita de `renglones` y de la sección sin nombre.
 */
export function totalesConCargo(totals: unknown, itemId: string, montoArs: number, signo: 1 | -1): Objeto {
  const t: Objeto = esObjeto(totals) ? structuredClone(totals) : {};
  const delta = signo * aCentavos(montoArs);
  const sumar = (v: unknown) => (numeroFinito(v) ? desdeCentavos(aCentavos(v) + delta) : v);
  if (numeroFinito(t.subtotal)) t.subtotal = sumar(t.subtotal);
  if (numeroFinito(t.total)) t.total = sumar(t.total);
  if (esObjeto(t.renglones)) {
    if (signo === 1) t.renglones[itemId] = { bruto: desdeCentavos(aCentavos(montoArs)), descuento: 0, neto: desdeCentavos(aCentavos(montoArs)) };
    else delete t.renglones[itemId];
  }
  if (Array.isArray(t.secciones)) {
    const secciones = t.secciones as Objeto[];
    const i = secciones.findIndex((s) => esObjeto(s) && (s.seccion ?? null) === null);
    if (i >= 0) {
      secciones[i] = { ...secciones[i], subtotal: sumar(secciones[i]!.subtotal) };
    } else if (signo === 1) {
      secciones.push({ seccion: null, subtotal: desdeCentavos(aCentavos(montoArs)), opcionales: 0 });
    }
  }
  return t;
}

/** Los ítems con el renglón del cargo al final. */
export function itemsConCargo(items: unknown, item: ItemCargo): unknown[] {
  return [...(Array.isArray(items) ? items : []), item];
}

/** Los ítems sin el renglón `itemId` (null si no estaba). */
export function itemsSinCargo(items: unknown, itemId: string): unknown[] | null {
  if (!Array.isArray(items)) return null;
  const i = items.findIndex((x) => esObjeto(x) && x.id === itemId);
  if (i < 0) return null;
  return items.filter((_, j) => j !== i);
}
