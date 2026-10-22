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
 * Los totales guardados con un cambio de `deltaArs` (positivo o negativo) en el renglón `itemId`, que
 * queda valiendo `renglonArs` (null = se quita de `renglones`). Sólo toca lo que ya es número: un
 * pedido migrado con `totals` vacío sigue vacío (y sin "ajuste"). El cambio va a la sección sin nombre.
 */
export function ajustarTotales(totals: unknown, itemId: string, renglonArs: number | null, deltaArs: number): Objeto {
  const t: Objeto = esObjeto(totals) ? structuredClone(totals) : {};
  const delta = aCentavos(deltaArs);
  const sumar = (v: unknown) => (numeroFinito(v) ? desdeCentavos(aCentavos(v) + delta) : v);
  if (numeroFinito(t.subtotal)) t.subtotal = sumar(t.subtotal);
  if (numeroFinito(t.total)) t.total = sumar(t.total);
  if (esObjeto(t.renglones)) {
    if (renglonArs !== null) t.renglones[itemId] = { bruto: desdeCentavos(aCentavos(renglonArs)), descuento: 0, neto: desdeCentavos(aCentavos(renglonArs)) };
    else delete t.renglones[itemId];
  }
  if (Array.isArray(t.secciones)) {
    const secciones = t.secciones as Objeto[];
    const i = secciones.findIndex((s) => esObjeto(s) && (s.seccion ?? null) === null);
    if (i >= 0) {
      secciones[i] = { ...secciones[i], subtotal: sumar(secciones[i]!.subtotal) };
    } else if (delta > 0) {
      secciones.push({ seccion: null, subtotal: desdeCentavos(delta), opcionales: 0 });
    }
  }
  return t;
}

/** Los totales con el cargo sumado (`signo` 1) o quitado (`signo` −1). */
export function totalesConCargo(totals: unknown, itemId: string, montoArs: number, signo: 1 | -1): Objeto {
  return ajustarTotales(totals, itemId, signo === 1 ? montoArs : null, signo * montoArs);
}

/** El precio del renglón `cargo-<cuotaId>` (cantidad 1); null si no está o no tiene esa forma. */
export function precioDelRenglonDeCargo(items: unknown, cuotaId: string): number | null {
  if (!Array.isArray(items)) return null;
  const it = items.find((x) => esObjeto(x) && x.id === itemDeCargo(cuotaId)) as Objeto | undefined;
  if (!it || it.cantidad !== 1 || !numeroFinito(it.precioUnitario)) return null;
  return it.precioUnitario;
}

/** Las cuotas que son de un cargo: las que tienen su renglón `cargo-<cuotaId>` en los ítems. */
export function cuotasDeCargo(items: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(items)) return ids;
  for (const x of items) {
    if (esObjeto(x) && typeof x.id === "string" && x.id.startsWith(PREFIJO_ITEM_CARGO)) ids.add(x.id.slice(PREFIJO_ITEM_CARGO.length));
  }
  return ids;
}

/** Lo que suman los renglones de cargos de los ítems (pesos): el total menos esto es el "total original". */
export function sumaDeRenglonesDeCargo(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  let c = 0;
  for (const x of items) {
    if (!esObjeto(x) || typeof x.id !== "string" || !x.id.startsWith(PREFIJO_ITEM_CARGO)) continue;
    const cantidad = numeroFinito(x.cantidad) ? x.cantidad : 1;
    if (numeroFinito(x.precioUnitario)) c += Math.round(cantidad * aCentavos(x.precioUnitario));
  }
  return desdeCentavos(c);
}

/** Los ítems con el renglón `itemId` a otro precio (null si no estaba). */
export function itemsConPrecio(items: unknown, itemId: string, precioArs: number): unknown[] | null {
  if (!Array.isArray(items)) return null;
  const i = items.findIndex((x) => esObjeto(x) && x.id === itemId);
  if (i < 0) return null;
  return items.map((x, j) => (j === i ? { ...(x as Objeto), precioUnitario: desdeCentavos(aCentavos(precioArs)) } : x));
}

/**
 * El saldo del pedido sin los cargos extra opcionales (centavos): a cada cuota de cargo se le resta
 * lo que le falta, con tope en el monto del cargo (`min(cuota, cargo) − imputado`). Si la cuota se
 * agrandó a mano y absorbió deuda de otras, ese excedente sigue contando; si quedó paga, no resta
 * nada. Una cuota que ya no está (`cuotaMinor` null) no resta nada.
 */
export function saldoSinCargosMinor(
  saldoMinor: number,
  cargos: readonly { montoMinor: number; cuotaMinor: number | null; imputadoMinor: number }[],
): number {
  let resta = 0;
  for (const c of cargos) {
    if (c.cuotaMinor === null) continue;
    resta += Math.max(0, Math.min(c.cuotaMinor, c.montoMinor) - Math.max(0, c.imputadoMinor));
  }
  return Math.max(0, saldoMinor - resta);
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
