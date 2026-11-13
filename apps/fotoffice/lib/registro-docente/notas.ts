import type { Categoria, Pesos, Recuperatorio, Redondeo, Reglas } from "./reglas";
import { CATEGORIAS } from "./reglas";

/**
 * Cálculo de notas del Registro docente. Puro y con pruebas: es el corazón del módulo.
 *
 * La nota del período que sale de acá es una SUGERENCIA. La nota final la decide la docente.
 */

export const TIPOS_EVALUACION = [
  "escrito",
  "oral",
  "tp",
  "tp_grupal",
  "exposicion",
  "carpeta",
  "participacion",
  "autoevaluacion",
] as const;
export type TipoEvaluacion = (typeof TIPOS_EVALUACION)[number];

export const TIPO_ETIQUETA: Record<TipoEvaluacion, string> = {
  escrito: "Escrito",
  oral: "Oral",
  tp: "Trabajo práctico",
  tp_grupal: "TP grupal",
  exposicion: "Exposición",
  carpeta: "Carpeta",
  participacion: "Participación",
  autoevaluacion: "Autoevaluación",
};

/** A qué peso suma cada tipo de evaluación. */
export const CATEGORIA_DE_TIPO: Record<TipoEvaluacion, Categoria> = {
  escrito: "examen",
  oral: "examen",
  tp: "trabajos",
  tp_grupal: "trabajos",
  exposicion: "trabajos",
  carpeta: "carpeta",
  participacion: "participacion",
  autoevaluacion: "participacion",
};

export function esTipoEvaluacion(v: unknown): v is TipoEvaluacion {
  return typeof v === "string" && (TIPOS_EVALUACION as readonly string[]).includes(v);
}

/** Valores especiales de una nota de evaluación. */
export const ESPECIALES_NOTA = ["AUSENTE", "NO_ENTREGO", "EXCEPTUADO"] as const;
export type EspecialNota = (typeof ESPECIALES_NOTA)[number];

export type EvaluacionParaCalculo = {
  id: string;
  tipo: TipoEvaluacion;
  periodo: string;
  notaMaxima: number;
  recuperaAId: string | null;
  /** Para ordenar varios recuperatorios de la misma evaluación. */
  fecha?: string | null;
};

export type NotaParaCalculo = { valor: number | null; especial: EspecialNota | null };

/** Redondeo a dos decimales sin los errores típicos de coma flotante (6,675 → 6,68). */
export function redondear2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** Lleva una nota al entero que pide la plataforma, según la regla de redondeo. */
export function aEntero(x: number, redondeo: Redondeo): number {
  const y = redondear2(x);
  if (redondeo === "abajo") return Math.floor(y);
  if (redondeo === "arriba") return Math.ceil(y);
  return Math.floor(y + 0.5);
}

function acotar(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/** La nota que muestra la docente: con dos decimales o entera, según la regla. */
export function presentarNota(x: number, r: Pick<Reglas, "decimales" | "redondeo" | "notaMinima" | "notaMaxima">): number {
  const v = acotar(x, r.notaMinima, r.notaMaxima);
  return r.decimales ? redondear2(v) : aEntero(v, r.redondeo);
}

function combinar(original: number | null, recuperatorio: number, regla: Recuperatorio): number {
  if (original === null) return recuperatorio;
  if (regla === "reemplaza") return recuperatorio;
  if (regla === "mejor") return Math.max(original, recuperatorio);
  return (original + recuperatorio) / 2;
}

export type ResultadoEvaluacion = {
  evaluacionId: string;
  /** En la escala del curso (notaMaxima de la evaluación llevada a la nota máxima de las reglas). */
  nota: number | null;
  /** Quedó sin nota y hay que resolverla (ausente al examen, no entregó, sin cargar). */
  pendiente: boolean;
};

export type CalculoPeriodo = {
  sugerida: number | null;
  porCategoria: Record<Categoria, { promedio: number | null; cantidad: number }>;
  evaluaciones: ResultadoEvaluacion[];
  pendientes: string[];
  /** Categorías con peso pero sin ninguna nota todavía: la sugerida se arma sin ellas. */
  sinNotas: Categoria[];
};

/**
 * Nota sugerida de un estudiante en un período.
 *
 * 1. Cada evaluación original del período se combina con sus recuperatorios según la regla
 *    (promedia, reemplaza o la mejor). Si faltó a la original, vale el recuperatorio.
 * 2. Exceptuado no cuenta. Ausente, no entregó o sin cargar quedan pendientes y no cuentan.
 * 3. Se promedia dentro de cada tipo (exámenes, TP, carpeta, participación) y se ponderan los tipos
 *    con los pesos. Un tipo que todavía no tiene notas se deja afuera y el resto se reparte su peso.
 */
export function calcularNotaPeriodo(input: {
  periodo: string;
  evaluaciones: readonly EvaluacionParaCalculo[];
  notas: ReadonlyMap<string, NotaParaCalculo>;
  reglas: Pick<Reglas, "pesos" | "recuperatorio" | "decimales" | "redondeo" | "notaMinima" | "notaMaxima">;
}): CalculoPeriodo {
  const { reglas } = input;
  const escala = (v: number, max: number) => (max > 0 ? (v / max) * reglas.notaMaxima : v);
  const originales = input.evaluaciones.filter((e) => e.periodo === input.periodo && !e.recuperaAId);
  const recuperatoriosDe = new Map<string, EvaluacionParaCalculo[]>();
  for (const e of input.evaluaciones) {
    if (!e.recuperaAId) continue;
    const lista = recuperatoriosDe.get(e.recuperaAId) ?? [];
    lista.push(e);
    recuperatoriosDe.set(e.recuperaAId, lista);
  }

  const resultados: ResultadoEvaluacion[] = [];
  const acumulado = new Map<Categoria, number[]>();

  for (const ev of originales) {
    const n = input.notas.get(ev.id);
    if (n?.especial === "EXCEPTUADO") {
      resultados.push({ evaluacionId: ev.id, nota: null, pendiente: false });
      continue;
    }
    let nota: number | null = n && n.especial === null && n.valor !== null ? escala(n.valor, ev.notaMaxima) : null;
    const recs = [...(recuperatoriosDe.get(ev.id) ?? [])].sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
    for (const rec of recs) {
      const nr = input.notas.get(rec.id);
      if (nr && nr.especial === null && nr.valor !== null) {
        nota = combinar(nota, escala(nr.valor, rec.notaMaxima), reglas.recuperatorio);
      }
    }
    if (nota === null) {
      resultados.push({ evaluacionId: ev.id, nota: null, pendiente: true });
      continue;
    }
    const v = redondear2(acotar(nota, reglas.notaMinima, reglas.notaMaxima));
    resultados.push({ evaluacionId: ev.id, nota: v, pendiente: false });
    const cat = CATEGORIA_DE_TIPO[ev.tipo];
    acumulado.set(cat, [...(acumulado.get(cat) ?? []), v]);
  }

  const porCategoria = {} as CalculoPeriodo["porCategoria"];
  for (const c of CATEGORIAS) {
    const vals = acumulado.get(c) ?? [];
    porCategoria[c] = { promedio: vals.length ? redondear2(vals.reduce((s, x) => s + x, 0) / vals.length) : null, cantidad: vals.length };
  }

  const sugerida = ponderar(porCategoria, reglas.pesos);
  const conPeso = CATEGORIAS.filter((c) => reglas.pesos[c] > 0);
  const tieneAlgo = conPeso.some((c) => porCategoria[c].promedio !== null);
  return {
    sugerida: sugerida === null ? null : presentarNota(sugerida, reglas),
    porCategoria,
    evaluaciones: resultados,
    pendientes: resultados.filter((r) => r.pendiente).map((r) => r.evaluacionId),
    sinNotas: tieneAlgo ? conPeso.filter((c) => porCategoria[c].promedio === null) : [],
  };
}

function ponderar(porCategoria: CalculoPeriodo["porCategoria"], pesos: Pesos): number | null {
  let suma = 0;
  let pesoTotal = 0;
  for (const c of CATEGORIAS) {
    const p = pesos[c];
    const prom = porCategoria[c].promedio;
    if (p <= 0 || prom === null) continue;
    suma += prom * p;
    pesoTotal += p;
  }
  return pesoTotal > 0 ? suma / pesoTotal : null;
}

/** Nota final sugerida del ciclo: el promedio de las notas finales de los períodos ya puestas. */
export function sugerirNotaFinal(
  notasDePeriodo: readonly (number | null)[],
  reglas: Pick<Reglas, "decimales" | "redondeo" | "notaMinima" | "notaMaxima">,
): { sugerida: number | null; faltan: number } {
  const vals = notasDePeriodo.filter((v): v is number => v !== null);
  const faltan = notasDePeriodo.length - vals.length;
  if (!vals.length) return { sugerida: null, faltan };
  return { sugerida: presentarNota(vals.reduce((s, x) => s + x, 0) / vals.length, reglas), faltan };
}

// ── Valores para la plataforma oficial (Mi Escuela de Santa Fe) ──────────────────────────────

export const ESPECIALES_PERIODO = ["EXCEPTUADO", "NO_CORRESPONDE", "SIN_CALIFICACION", "AUSENTE", "EN_PROCESO"] as const;
export type EspecialPeriodo = (typeof ESPECIALES_PERIODO)[number];

export const ESPECIAL_PERIODO_ETIQUETA: Record<EspecialPeriodo, string> = {
  EXCEPTUADO: "Exceptuado",
  NO_CORRESPONDE: "No corresponde",
  SIN_CALIFICACION: "Sin calificación",
  AUSENTE: "Ausente",
  EN_PROCESO: "En proceso",
};

/** Lo que se elige en el desplegable de Mi Escuela. */
const ESPECIAL_MI_ESCUELA: Record<EspecialPeriodo, string> = {
  EXCEPTUADO: "Exceptuado",
  NO_CORRESPONDE: "No corresponde",
  SIN_CALIFICACION: "Sin calificación",
  AUSENTE: "Ausente",
  EN_PROCESO: "En proceso",
};

export function esEspecialPeriodo(v: unknown): v is EspecialPeriodo {
  return typeof v === "string" && (ESPECIALES_PERIODO as readonly string[]).includes(v);
}

/**
 * Lo que hay que elegir en Mi Escuela para una nota: un entero del 1 al 10 o el valor especial.
 * Vacío si todavía no hay nota.
 */
export function valorParaMiEscuela(
  nota: { final: number | null; especial: EspecialPeriodo | null },
  reglas: Pick<Reglas, "redondeo">,
): string {
  if (nota.especial) return ESPECIAL_MI_ESCUELA[nota.especial];
  if (nota.final === null) return "";
  return String(acotar(aEntero(nota.final, reglas.redondeo), 1, 10));
}

/**
 * Lee lo que la docente escribe en una celda de la planilla: «7», «7,5», «8t» (entregó tarde),
 * «A» (ausente), «NE» (no entregó), «EX» (exceptuado). Vacío borra la nota.
 */
export function leerCelda(
  texto: string,
  notaMaxima: number,
): { ok: true; vacia: true } | { ok: true; vacia: false; valor: number | null; especial: EspecialNota | null; entregaTarde: boolean } | { ok: false; error: string } {
  const t = texto.trim().toUpperCase().replace(/\s+/g, "");
  if (!t) return { ok: true, vacia: true };
  if (t === "A" || t === "AUS") return { ok: true, vacia: false, valor: null, especial: "AUSENTE", entregaTarde: false };
  if (t === "NE") return { ok: true, vacia: false, valor: null, especial: "NO_ENTREGO", entregaTarde: false };
  if (t === "EX") return { ok: true, vacia: false, valor: null, especial: "EXCEPTUADO", entregaTarde: false };
  const m = /^(\d{1,3}(?:[.,]\d{1,2})?)(T)?$/.exec(t);
  if (!m) return { ok: false, error: "Escribí un número, A (ausente), NE (no entregó) o EX (exceptuado)." };
  const valor = Number(m[1].replace(",", "."));
  if (valor < 0 || valor > notaMaxima) return { ok: false, error: `La nota va de 0 a ${formatearNota(notaMaxima)}.` };
  return { ok: true, vacia: false, valor, especial: null, entregaTarde: m[2] === "T" };
}

export function textoDeCelda(n: { valor: number | null; especial: string | null; entregaTarde: boolean } | null | undefined): string {
  if (!n) return "";
  if (n.especial === "AUSENTE") return "A";
  if (n.especial === "NO_ENTREGO") return "NE";
  if (n.especial === "EXCEPTUADO") return "EX";
  if (n.valor === null) return "";
  return `${formatearNota(n.valor)}${n.entregaTarde ? "t" : ""}`;
}

/** 7 → «7»; 7.5 → «7,5»; 6.75 → «6,75». */
export function formatearNota(x: number): string {
  return String(redondear2(x)).replace(".", ",");
}
