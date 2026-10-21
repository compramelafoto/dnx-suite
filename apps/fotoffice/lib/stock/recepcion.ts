import { entradaEnUnidades } from "./unidades";
import type { OrigenLinea } from "./recepcion-constantes";

/** Una línea del borrador de recepción. El costo va en minor (centavos) por la unidad en que se cargó. */
export type LineaBorrador = {
  id: string;
  productId: string | null;
  descripcionOriginal: string;
  codigoBarras: string | null;
  cantidad: number;
  enUnidadDeCompra: boolean;
  unidadesPorCompra: number | null;
  costoUnitarioMinor: number | null;
  origen: OrigenLinea;
};

/**
 * Qué hacer al escanear un producto: sumar uno a la primera línea suelta (no en bultos)
 * de ese producto, o crear una línea nueva si no hay.
 */
export function lineaParaEscaneo(
  lineas: readonly LineaBorrador[],
  productId: string,
): { accion: "sumar"; lineaId: string } | { accion: "crear" } {
  const existente = lineas.find((x) => x.productId === productId && !x.enUnidadDeCompra);
  return existente ? { accion: "sumar", lineaId: existente.id } : { accion: "crear" };
}

/** Chequeos para poder confirmar la recepción. Devuelve el primer problema, en lenguaje llano. */
export function validarParaConfirmar(
  lineas: readonly LineaBorrador[],
): { ok: true } | { ok: false; error: string } {
  if (lineas.length === 0) return { ok: false, error: "Cargá al menos un producto." };
  if (lineas.some((x) => !x.productId)) {
    return { ok: false, error: "Hay líneas sin producto: elegilo o quitalas." };
  }
  if (lineas.some((x) => !Number.isInteger(x.cantidad) || x.cantidad <= 0)) {
    return { ok: false, error: "La cantidad tiene que ser mayor que cero." };
  }
  if (
    lineas.some(
      (x) =>
        x.enUnidadDeCompra &&
        (!Number.isInteger(x.unidadesPorCompra) || (x.unidadesPorCompra as number) < 1),
    )
  ) {
    return { ok: false, error: "Decí cuántas unidades trae cada bulto." };
  }
  return { ok: true };
}

/** El movimiento de stock de una línea, ya en unidad de stock (bultos × unidades por bulto). */
export function movimientoDeLinea(l: LineaBorrador): {
  productId: string;
  qty: number;
  unitCostMinor: number | null;
} {
  const { qty, unitCostMinor } = entradaEnUnidades({
    cantidad: l.cantidad,
    enUnidadDeCompra: l.enUnidadDeCompra,
    unidadesPorCompra: l.unidadesPorCompra,
    costoMinor: l.costoUnitarioMinor,
  });
  return { productId: l.productId as string, qty, unitCostMinor };
}

/** Total de la recepción: cantidad × costo por la unidad cargada. Una línea sin costo suma 0. */
export function totalRecepcionMinor(lineas: readonly LineaBorrador[]): number {
  return lineas.reduce((acc, x) => acc + x.cantidad * (x.costoUnitarioMinor ?? 0), 0);
}

/** ¿El costo por unidad de stock subió respecto del anterior? Sin costo anterior o nuevo: no. */
export function costoSubio(
  anteriorMinor: number | null,
  nuevoPorUnidadMinor: number | null,
): boolean {
  if (anteriorMinor === null || nuevoPorUnidadMinor === null) return false;
  return nuevoPorUnidadMinor > anteriorMinor;
}
