/**
 * Costo y margen de una versión de presupuesto. Módulo PURO: lo usan el servidor (para la
 * instantánea `costSnapshot` de cada guardado) y el editor, en vivo, sólo para quien tiene
 * `configurar` (R4). A quien no lo tiene, la página nunca le pasa costos: este cálculo no tiene
 * con qué correr.
 */
import type { ItemPresupuesto } from "./constantes";
import type { TotalesPresupuesto } from "./totales";

export type OrigenCosto = "CALCULO" | "COSTOS_PLANTILLA" | "COSTO_PRODUCTO";

/** `costSnapshot`. Pesos con dos decimales. INTERNO. */
export type CostosVersion = {
  porItem: Record<string, { costo: number | null; origen: OrigenCosto | null; margen: number | null }>;
  /** Costo conocido de los renglones que suman (los opcionales no). */
  costoTotal: number;
  /** Renglones que suman y no tienen costo conocido (texto libre, producto sin costos). */
  itemsSinCosto: number;
  /** Total menos costo conocido. */
  margen: number;
  /** Margen sobre el total (null si el total es 0). */
  margenProporcion: number | null;
};

export type CostoDeCatalogo = {
  /** Costos-plantilla del producto (en pesos). Si hay, mandan sobre `costoProducto`. */
  plantillas: { importe: number; porUnidad: boolean }[];
  /** `Product.costArs`, por unidad; null si no tiene. */
  costoProducto: number | null;
};

const aCentavos = (pesos: number): number => Math.round(pesos * 100);
const aPesos = (centavos: number): number => centavos / 100;

/**
 * Costo y margen de una versión.
 * - ítem de ¿Cuánto Cobro?: la base de costo del motor (`costoBase`, con la que mide su margen);
 * - ítem del catálogo: sus costos-plantilla (fijos una vez, por unidad × cantidad) o, si no tiene,
 *   su costo por unidad × cantidad;
 * - ítem de texto libre o sin costos: sin costo conocido.
 */
export function costosDeVersion(
  items: readonly ItemPresupuesto[],
  totales: TotalesPresupuesto,
  catalogo: ReadonlyMap<string, CostoDeCatalogo>,
): CostosVersion {
  const porItem: CostosVersion["porItem"] = {};
  let costo = 0;
  let sinCosto = 0;
  for (const it of items) {
    let c: number | null = null;
    let origen: OrigenCosto | null = null;
    if (it.modoPrecio === "CALCULO" && it.calculo) {
      c = aCentavos(it.calculo.costoBase);
      origen = "CALCULO";
    } else if (it.productId && catalogo.has(it.productId)) {
      const k = catalogo.get(it.productId)!;
      if (k.plantillas.length > 0) {
        c = k.plantillas.reduce((s, p) => s + (p.porUnidad ? Math.round(aCentavos(p.importe) * it.cantidad) : aCentavos(p.importe)), 0);
        origen = "COSTOS_PLANTILLA";
      } else if (k.costoProducto !== null) {
        c = Math.round(aCentavos(k.costoProducto) * it.cantidad);
        origen = "COSTO_PRODUCTO";
      }
    }
    const neto = aCentavos(totales.renglones[it.id]?.neto ?? 0);
    porItem[it.id] = { costo: c === null ? null : aPesos(c), origen, margen: c === null ? null : aPesos(neto - c) };
    if (it.opcional) continue;
    if (c === null) sinCosto += 1;
    else costo += c;
  }
  const total = aCentavos(totales.total);
  const margen = total - costo;
  return {
    porItem,
    costoTotal: aPesos(costo),
    itemsSinCosto: sinCosto,
    margen: aPesos(margen),
    margenProporcion: total > 0 ? Math.round((margen / total) * 10_000) / 10_000 : null,
  };
}
