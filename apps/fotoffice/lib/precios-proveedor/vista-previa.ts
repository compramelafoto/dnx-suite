import { precioSugeridoMinor } from "./margen";
import type { TramoRedondeo } from "./redondeo";

/**
 * Qué cambiaría al aplicar una lista. Módulo PURO.
 *
 * Una lista sólo mueve el costo (y el precio) de los productos cuyo proveedor preferido es el
 * de la lista: si el preferido es otro, el renglón queda como referencia y no toca nada.
 */

export type MarcaVistaPrevia = "SIN_MARGEN" | "BAJA" | "SUBE_MUCHO" | "OTRO_PROVEEDOR" | "VARIANTES";

export type ProductoParaVista = {
  name: string;
  costMinor: number | null;
  priceMinor: number;
  marginPct: number | null;
  preferredProveedorId: string | null;
  variantesConPrecio: boolean;
};

export type FilaVistaPrevia = {
  productId: string;
  nombre: string;
  aplica: boolean;
  costoAntesMinor: number | null;
  costoNuevoMinor: number;
  precioAntesMinor: number;
  precioNuevoMinor: number;
  marginPct: number | null;
  marcas: MarcaVistaPrevia[];
};

export const SUBA_FUERTE = 0.3;

export function armarVistaPrevia(
  items: readonly { productId: string; costoMinor: number; factor: number }[],
  productos: ReadonlyMap<string, ProductoParaVista>,
  proveedorId: string,
  tramos: readonly TramoRedondeo[],
): FilaVistaPrevia[] {
  const porProducto = new Map<string, FilaVistaPrevia>();
  for (const it of items) {
    const p = productos.get(it.productId);
    if (!p) continue;
    const costoNuevoMinor = Math.round(it.costoMinor * it.factor);
    const aplica = p.preferredProveedorId === proveedorId;
    const marcas: MarcaVistaPrevia[] = [];
    let precioNuevoMinor = p.priceMinor;
    if (!aplica) {
      marcas.push("OTRO_PROVEEDOR");
    } else if (p.marginPct === null) {
      marcas.push("SIN_MARGEN");
    } else {
      precioNuevoMinor = precioSugeridoMinor(costoNuevoMinor, p.marginPct, tramos);
      if (precioNuevoMinor < p.priceMinor) marcas.push("BAJA");
      if (precioNuevoMinor > p.priceMinor * (1 + SUBA_FUERTE)) marcas.push("SUBE_MUCHO");
    }
    if (p.variantesConPrecio) marcas.push("VARIANTES");
    porProducto.set(it.productId, {
      productId: it.productId,
      nombre: p.name,
      aplica,
      costoAntesMinor: p.costMinor,
      costoNuevoMinor,
      precioAntesMinor: p.priceMinor,
      precioNuevoMinor,
      marginPct: p.marginPct,
      marcas,
    });
  }
  return [...porProducto.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
