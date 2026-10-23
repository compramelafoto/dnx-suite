import { normalizarMedida } from "@/lib/precios-proveedor/clave";
import { esTapaFlexible, MAXIMO_HOJAS, type TipoTapa } from "./cotizar";
import { medidaPorId } from "./medidas-pliego";

/**
 * El fotolibro vendido en el Cobrador. Módulo PURO.
 *
 * Los productos del catálogo se reconocen por su código interno (SKU): al agregarlos se abre la
 * calculadora en vez de sumarse con el precio de lista. La caja va en su propio renglón.
 */

export const SKU_FOTOLIBRO_FLEXIBLE = "FOTOLIBRO-FLEXIBLE";
export const SKU_FOTOLIBRO_RIGIDA = "FOTOLIBRO-RIGIDA";
export const SKU_CAJA_FOTOLIBRO = "FOTOLIBRO-CAJA";

export function tipoTapaDeSku(sku: string | null | undefined): TipoTapa | null {
  const s = sku?.trim().toUpperCase();
  return s === SKU_FOTOLIBRO_FLEXIBLE ? "FLEXIBLE" : s === SKU_FOTOLIBRO_RIGIDA ? "RIGIDA" : null;
}

export function esSkuCajaFotolibro(sku: string | null | undefined): boolean {
  return sku?.trim().toUpperCase() === SKU_CAJA_FOTOLIBRO;
}

/**
 * La medida del editor (pliego real) para lo que se eligió en la calculadora: la tapa flexible
 * tiene su propio pliego, un poco más largo. Si el laboratorio no tiene flexible en esa medida,
 * el de hojas rígidas.
 */
export function medidaPliegoDe(modelo: string, medida: string): string | null {
  const m = normalizarMedida(medida) ?? medida;
  const flexible = `flexible-${m}`;
  const rigido = `rigido-${m}`;
  if (esTapaFlexible(modelo) && medidaPorId(flexible)) return flexible;
  return medidaPorId(rigido) ? rigido : null;
}

/** Lo que viaja con el renglón del libro hasta el pedido. */
export type FotolibroVendido = {
  proveedorId: string;
  modelo: string;
  medida: string;
  hojas: number;
  /** Cuántas fotos dijo el cliente (null si no se cargó). */
  fotos: number | null;
  /** Costo del libro y de la caja para el laboratorio; null si quien vende no ve costos. */
  costoMinor: number | null;
  cajaCostoMinor: number | null;
  /** El fotolibro del editor, si se creó antes de cobrar. */
  templateId: string | null;
};

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const TEXTO = (x: unknown, max: number): x is string => typeof x === "string" && x.trim() !== "" && x.length <= max;
const MONTO = (x: unknown): x is number | null => x === null || (Number.isInteger(x) && (x as number) >= 0);

/** Lo que manda el navegador: se confía sólo en la forma, nunca en precios. */
export function leerFotolibroVendido(x: unknown): FotolibroVendido | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.proveedorId !== "string" || !ID.test(o.proveedorId)) return null;
  if (!TEXTO(o.modelo, 200) || !TEXTO(o.medida, 20)) return null;
  if (!Number.isInteger(o.hojas) || (o.hojas as number) < 1 || (o.hojas as number) > MAXIMO_HOJAS) return null;
  const fotos = o.fotos === null || o.fotos === undefined ? null : o.fotos;
  if (fotos !== null && (!Number.isInteger(fotos) || (fotos as number) < 0 || (fotos as number) > 100_000)) return null;
  const costo = o.costoMinor ?? null;
  const cajaCosto = o.cajaCostoMinor ?? null;
  if (!MONTO(costo) || !MONTO(cajaCosto)) return null;
  const templateId = o.templateId ?? null;
  if (templateId !== null && (typeof templateId !== "string" || !ID.test(templateId))) return null;
  return {
    proveedorId: o.proveedorId,
    modelo: o.modelo.trim(),
    medida: o.medida.trim(),
    hojas: o.hojas as number,
    fotos: fotos as number | null,
    costoMinor: costo,
    cajaCostoMinor: cajaCosto,
    templateId: templateId as string | null,
  };
}
