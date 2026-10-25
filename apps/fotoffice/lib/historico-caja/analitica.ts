/**
 * Analítica del histórico para el tablero del estudio (spec 7.3 y 7.4). Módulo PURO.
 *
 * Trabaja sobre filas ya agrupadas por mes, clase y rubro (las arma `repositorio.ts` desde la base
 * con los lotes CONFIRMADOS, o `filasAnaliticasDeLotes` desde lotes armados en memoria). Todo en
 * centavos; los egresos llegan con signo negativo y se muestran en positivo.
 */
import { sumarMeses, type ClaseHistorico, type LoteArmado } from "./tipos";

export type FilaAnalitica = {
  mes: string;
  clase: ClaseHistorico;
  rubroCodigo: string | null;
  rubroNombre: string | null;
  centavos: number;
  estimado: boolean;
};

function mesesOrdenados(filas: readonly FilaAnalitica[]): string[] {
  return [...new Set(filas.map((f) => f.mes))].sort();
}

/** Ingresos por línea de negocio (rubros 3…) y mes. Neto: una corrección negativa resta. */
export function ingresosPorLinea(filas: readonly FilaAnalitica[]): {
  meses: string[];
  lineas: { codigo: string | null; nombre: string; porMes: number[]; total: number }[];
  totalPorMes: number[];
} {
  const ingresos = filas.filter((f) => f.clase === "INGRESO");
  const meses = mesesOrdenados(ingresos);
  const idx = new Map(meses.map((m, i) => [m, i]));
  const lineas = new Map<string, { codigo: string | null; nombre: string; porMes: number[]; total: number }>();
  for (const f of ingresos) {
    const k = f.rubroCodigo ?? "";
    const l = lineas.get(k) ?? { codigo: f.rubroCodigo, nombre: f.rubroNombre ?? "Sin línea", porMes: meses.map(() => 0), total: 0 };
    l.porMes[idx.get(f.mes)!] += f.centavos;
    l.total += f.centavos;
    lineas.set(k, l);
  }
  const lista = [...lineas.values()].sort((a, b) => (a.codigo ?? "~").localeCompare(b.codigo ?? "~", "es", { numeric: true }));
  return { meses, lineas: lista, totalPorMes: meses.map((_, i) => lista.reduce((s, l) => s + l.porMes[i], 0)) };
}

const CLASES_DE_EGRESO: ClaseHistorico[] = ["COSTO_VARIABLE", "GASTO_FIJO", "RETIRO_DUENO", "SIN_CLASIFICAR"];

/** Egresos por clase y mes, en positivo. Los movimientos internos no son egresos. */
export function egresosPorClase(filas: readonly FilaAnalitica[]): {
  meses: string[];
  clases: { clase: ClaseHistorico; porMes: number[]; total: number; estimadoPorMes: number[] }[];
} {
  const egresos = filas.filter((f) => CLASES_DE_EGRESO.includes(f.clase) && !(f.clase === "SIN_CLASIFICAR" && f.centavos > 0));
  const meses = mesesOrdenados(egresos);
  const idx = new Map(meses.map((m, i) => [m, i]));
  const clases = CLASES_DE_EGRESO.map((clase) => ({ clase, porMes: meses.map(() => 0), total: 0, estimadoPorMes: meses.map(() => 0) }));
  for (const f of egresos) {
    const c = clases.find((x) => x.clase === f.clase)!;
    const i = idx.get(f.mes)!;
    c.porMes[i] -= f.centavos;
    c.total -= f.centavos;
    if (f.estimado) c.estimadoPorMes[i] -= f.centavos;
  }
  return { meses, clases: clases.filter((c) => c.porMes.some((v) => v !== 0)) };
}

/** Los `n` meses cerrados anteriores a `mesActual`, del más viejo al más nuevo. */
export function mesesCerradosAnteriores(mesActual: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => sumarMeses(mesActual, i - n));
}

/**
 * Promedio real de gastos fijos (clase 5…) de los últimos `meses` meses cerrados.
 * Divide siempre por la cantidad de meses: un mes sin datos no es un mes sin gastos, por eso se avisa
 * aparte (`mesesSinDatos`), igual que los meses con fijos incompletos y si hay estimados adentro.
 */
export function promedioFijos(
  filas: readonly FilaAnalitica[],
  opciones: { mesActual: string; meses?: number; incompletos?: ReadonlySet<string> },
): { meses: string[]; promedioCentavos: number; incluyeEstimados: boolean; mesesSinDatos: string[]; mesesIncompletos: string[] } {
  const meses = mesesCerradosAnteriores(opciones.mesActual, opciones.meses ?? 3);
  const conDatos = new Set(filas.map((f) => f.mes));
  const fijos = filas.filter((f) => f.clase === "GASTO_FIJO" && meses.includes(f.mes));
  const total = -fijos.reduce((s, f) => s + f.centavos, 0);
  return {
    meses,
    promedioCentavos: Math.round(total / meses.length),
    incluyeEstimados: fijos.some((f) => f.estimado),
    mesesSinDatos: meses.filter((m) => !conDatos.has(m)),
    mesesIncompletos: meses.filter((m) => opciones.incompletos?.has(m)),
  };
}

/**
 * Punto de equilibrio (spec 7.4). Contribución necesaria = fijos + retiro. Las ventas necesarias
 * salen del margen de contribución observado (1 − costos variables ÷ ingresos). Sin ingresos o
 * con margen ≤ 0 no hay volumen de ventas que alcance: `null`.
 */
export function puntoDeEquilibrio(entrada: {
  fijosMensualesCentavos: number;
  retiroMensualCentavos: number;
  ingresosCentavos: number;
  costosVariablesCentavos: number;
}): { contribucionNecesariaCentavos: number; margenContribucion: number | null; ventasNecesariasCentavos: number | null } {
  const contribucion = Math.abs(entrada.fijosMensualesCentavos) + Math.abs(entrada.retiroMensualCentavos);
  if (entrada.ingresosCentavos <= 0) return { contribucionNecesariaCentavos: contribucion, margenContribucion: null, ventasNecesariasCentavos: null };
  const margen = 1 - Math.abs(entrada.costosVariablesCentavos) / entrada.ingresosCentavos;
  if (margen <= 0) return { contribucionNecesariaCentavos: contribucion, margenContribucion: margen, ventasNecesariasCentavos: null };
  return { contribucionNecesariaCentavos: contribucion, margenContribucion: margen, ventasNecesariasCentavos: Math.floor(contribucion / margen) };
}

/** Filas analíticas desde lotes armados en memoria (corrida en seco). */
export function filasAnaliticasDeLotes(lotes: readonly LoteArmado[]): FilaAnalitica[] {
  const mapa = new Map<string, FilaAnalitica>();
  for (const l of lotes) {
    for (const m of l.movimientos) {
      const k = `${l.mes}|${m.clase}|${m.rubroCodigo ?? ""}|${m.estimado}`;
      const f = mapa.get(k) ?? { mes: l.mes, clase: m.clase, rubroCodigo: m.rubroCodigo, rubroNombre: m.rubroNombre, centavos: 0, estimado: m.estimado };
      f.centavos += m.centavos;
      mapa.set(k, f);
    }
  }
  return [...mapa.values()];
}
