/**
 * Gastos recurrentes que faltan en un mes (spec 7.6). Módulo PURO.
 *
 * Recurrente = egreso con el mismo rubro y concepto en 3 o más de los 6 meses anteriores. Si en el
 * mes no hay nada de ese rubro (ni ese concepto), el resumen lo lista ("No encontramos: …") para
 * agregar un estimado o descartarlo. Los estimados cuentan como presentes: "EXPENSAS (ESTIMADO)"
 * cubre "EXPENSAS" porque es el mismo rubro.
 */
import { CLASES_EGRESO, sumarMeses, type ClaseHistorico, type Faltante } from "./tipos";

export type PresenciaGasto = {
  mes: string;
  concepto: string;
  rubroCodigo: string | null;
  rubroNombre: string | null;
  clase: ClaseHistorico;
};

const EGRESOS = new Set<ClaseHistorico>(CLASES_EGRESO);

function clave(p: Pick<PresenciaGasto, "concepto" | "rubroCodigo">): string {
  return `${p.rubroCodigo ?? ""}|${p.concepto}`;
}

export function faltantesRecurrentes(
  mes: string,
  historia: readonly PresenciaGasto[],
  delMes: readonly PresenciaGasto[],
  opciones: { ventana?: number; minimo?: number } = {},
): Faltante[] {
  const ventana = opciones.ventana ?? 6;
  const minimo = opciones.minimo ?? 3;
  const desde = sumarMeses(mes, -ventana);
  const meses = new Map<string, { p: PresenciaGasto; meses: Set<string> }>();
  for (const p of historia) {
    if (!EGRESOS.has(p.clase) || p.mes < desde || p.mes >= mes) continue;
    const k = clave(p);
    const e = meses.get(k) ?? { p, meses: new Set<string>() };
    e.meses.add(p.mes);
    meses.set(k, e);
  }
  const presentes = new Set(delMes.map(clave));
  const rubrosPresentes = new Set(delMes.map((p) => p.rubroCodigo).filter((r): r is string => r !== null));
  return [...meses.entries()]
    .filter(([k, e]) => e.meses.size >= minimo && !presentes.has(k) && !(e.p.rubroCodigo && rubrosPresentes.has(e.p.rubroCodigo)))
    .map(([, e]) => ({ concepto: e.p.concepto, rubroCodigo: e.p.rubroCodigo, rubroNombre: e.p.rubroNombre, mesesVistos: e.meses.size }))
    .sort((a, b) => b.mesesVistos - a.mesesVistos || a.concepto.localeCompare(b.concepto));
}
