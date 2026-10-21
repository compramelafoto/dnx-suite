import { entradaEnUnidades } from "./unidades";
import type { LineaBorrador } from "./recepcion";

/**
 * Cuentas chicas de la pantalla de recepción. Puro: lo usan la página (servidor) y el editor
 * (navegador), con la misma conversión a unidad de stock que usa confirmar.
 */

function enUnidades(l: LineaBorrador) {
  return entradaEnUnidades({
    cantidad: l.cantidad,
    enUnidadDeCompra: l.enUnidadDeCompra,
    unidadesPorCompra: l.unidadesPorCompra,
    costoMinor: l.costoUnitarioMinor,
  });
}

/** Cuántas unidades de stock suma la recepción al confirmarla (los bultos ya abiertos). */
export function unidadesDeStock(lineas: readonly LineaBorrador[]): number {
  return lineas.reduce((acc, l) => acc + enUnidades(l).qty, 0);
}

/** El costo de la línea por unidad de stock (el del bulto repartido), o null si no tiene costo. */
export function costoPorUnidadDeStock(l: LineaBorrador): number | null {
  return enUnidades(l).unitCostMinor;
}

const ZONA = "America/Argentina/Buenos_Aires";
const diaAR = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * "aaaa-mm-dd" del campo de fecha → el mediodía de ese día en Buenos Aires (15:00 UTC). Al
 * mediodía, el día se lee igual en cualquier zona razonable. Un texto que no es fecha da null.
 */
export function fechaDesdeInput(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 15));
  return d.toISOString().slice(0, 10) === `${m[1]}-${m[2]}-${m[3]}` ? d : null;
}

/** El día (en Buenos Aires) de un instante, como lo espera un `<input type="date">`. */
export function diaParaInput(d: Date): string {
  return diaAR.format(d);
}
