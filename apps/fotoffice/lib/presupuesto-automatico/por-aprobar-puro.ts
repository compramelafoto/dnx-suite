import { pesos } from "@/lib/presupuestos/editor";
import type { PresupuestoDelResumen } from "./resumen";

/**
 * PURO. El precio de una fila de «Cotizaciones por aprobar»: el total o, con opciones (Básico,
 * Premium…), el rango de la más barata a la más cara. Nunca costos ni márgenes.
 */
export function precioDeLaFila(p: Pick<PresupuestoDelResumen, "total" | "alternativas">): string {
  const totales = (p.alternativas ?? []).map((a) => a.total).filter((t) => Number.isFinite(t));
  if (totales.length === 0) return pesos(p.total);
  const min = Math.min(...totales);
  const max = Math.max(...totales);
  return min === max ? pesos(min) : `${pesos(min)} a ${pesos(max)}`;
}
