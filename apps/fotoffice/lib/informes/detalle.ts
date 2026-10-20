/**
 * Desglose de una celda de Informes (etapa 6). Módulo PURO: lee y valida los parámetros de la
 * dirección y decide qué asientos pertenecen a una celda de la matriz. La lectura vive en
 * `detalle-datos.ts`.
 */
import { diaEnBuenosAires } from "./fechas";
import { claveBloqueDeAsiento, type Asiento, type ClaveBloque, type RubroInfo } from "./resultados";

export const BLOQUES_DETALLE: readonly ClaveBloque[] = ["INGRESOS", "COSTOS", "GASTOS", "SIN_CLASIFICAR_INGRESO", "SIN_CLASIFICAR_EGRESO"];

/** Máximo de renglones que se dibujan; el total siempre suma todos. */
export const MAX_FILAS_DETALLE = 500;

export type RubroDeCelda = { tipo: "todos" } | { tipo: "sin" } | { tipo: "id"; id: string; conHijos: boolean };

export type FiltroCeldaResultados = {
  bloque: ClaveBloque;
  rubro: RubroDeCelda;
  /** "AAAA-MM", o `null` para todo el período. */
  mes: string | null;
};

/** Un renglón del desglose: lo que forma el importe de una celda. */
export type FilaDetalle = {
  clave: string;
  /** "AAAA-MM-DD" */
  fecha: string;
  origen: string;
  contacto: string | null;
  descripcion: string;
  /** Con signo: una anulación resta. */
  centavos: number;
  href: string | null;
};

type Params = Record<string, string | string[] | undefined>;

function texto(v: string | string[] | undefined): string | null {
  const t = Array.isArray(v) ? v[0] : v;
  return typeof t === "string" && t.trim() !== "" ? t.trim() : null;
}

/** Lee la celda de la dirección; `null` si el bloque no es válido. El mes se acepta sólo si está en el período. */
export function leerFiltroCelda(sp: Params, mesesDelPeriodo: readonly string[]): FiltroCeldaResultados | null {
  const bloque = texto(sp.bloque);
  if (!bloque || !(BLOQUES_DETALLE as readonly string[]).includes(bloque)) return null;
  const rubroCrudo = texto(sp.rubro);
  let rubro: RubroDeCelda = { tipo: "todos" };
  if (rubroCrudo === "sin") rubro = { tipo: "sin" };
  else if (rubroCrudo && rubroCrudo.length <= 64) rubro = { tipo: "id", id: rubroCrudo, conHijos: texto(sp.hijos) === "1" };
  const mes = texto(sp.mes);
  return { bloque: bloque as ClaveBloque, rubro, mes: mes && mesesDelPeriodo.includes(mes) ? mes : null };
}

/** Dirección del desglose de una celda (se usa desde la matriz y desde el CSV). */
export function paramsDeCelda(f: FiltroCeldaResultados, base: string, periodo: string): URLSearchParams {
  const p = new URLSearchParams({ base, periodo, bloque: f.bloque });
  if (f.rubro.tipo === "sin") p.set("rubro", "sin");
  if (f.rubro.tipo === "id") {
    p.set("rubro", f.rubro.id);
    if (f.rubro.conHijos) p.set("hijos", "1");
  }
  if (f.mes) p.set("mes", f.mes);
  return p;
}

function padreDe(categoryId: string | null, porId: ReadonlyMap<string, RubroInfo>): string | null {
  if (!categoryId) return null;
  const r = porId.get(categoryId);
  return r?.parentId && r.parentId !== r.id ? r.parentId : null;
}

/** ¿Este asiento forma parte de la celda? Usa la misma clasificación que la matriz. */
export function asientoEnCelda(a: Asiento, f: FiltroCeldaResultados, porId: ReadonlyMap<string, RubroInfo>): boolean {
  if (f.mes !== null && a.mes !== f.mes) return false;
  if (claveBloqueDeAsiento(a, porId) !== f.bloque) return false;
  switch (f.rubro.tipo) {
    case "todos":
      return true;
    case "sin":
      return a.categoryId === null;
    case "id":
      return a.categoryId === f.rubro.id || (f.rubro.conHijos && padreDe(a.categoryId, porId) === f.rubro.id);
  }
}

export function ordenarFilas(filas: FilaDetalle[]): FilaDetalle[] {
  return [...filas].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0));
}

export function totalDeFilas(filas: readonly { centavos: number }[]): number {
  return filas.reduce((s, f) => s + f.centavos, 0);
}

export function fechaDeInstante(d: Date): string {
  return diaEnBuenosAires(d);
}

/** "2026-03-05" → "05/03/2026". */
export function fechaLarga(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
}

// --- Flujo ----------------------------------------------------------------------------------------

export const TIPOS_DETALLE_FLUJO = ["cobrar", "pagar", "sinfecha"] as const;
export type TipoDetalleFlujo = (typeof TIPOS_DETALLE_FLUJO)[number];

export type FiltroFlujo = {
  tipo: TipoDetalleFlujo;
  /** Primer día incluido; `null` = sin límite inferior (lo vencido). */
  desde: string | null;
  /** Último día incluido; `null` para "sinfecha". */
  hasta: string | null;
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;

function diaValido(v: string | null): v is string {
  if (!v || !DIA.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Lee el filtro del desglose del flujo; `null` si es inválido o si `hasta` pasa del límite. */
export function leerFiltroFlujo(sp: Params, maximo: string): FiltroFlujo | null {
  const tipo = texto(sp.tipo);
  if (!tipo || !(TIPOS_DETALLE_FLUJO as readonly string[]).includes(tipo)) return null;
  if (tipo === "sinfecha") return { tipo: "sinfecha", desde: null, hasta: null };
  const desde = texto(sp.desde);
  const hasta = texto(sp.hasta);
  if (!diaValido(hasta) || hasta > maximo) return null;
  if (desde !== null && (!diaValido(desde) || desde > hasta)) return null;
  return { tipo: tipo as TipoDetalleFlujo, desde, hasta };
}

export function paramsDeFlujo(f: FiltroFlujo): URLSearchParams {
  const p = new URLSearchParams({ tipo: f.tipo });
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  return p;
}
