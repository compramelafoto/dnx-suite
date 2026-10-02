import type { RangoFechas } from "./tipos";


export const ATAJOS_PERIODO = [
  "hoy", "esta-semana", "semana-pasada", "este-mes", "mes-pasado", "ultimos-3-meses", "este-anio", "anio-pasado",
] as const;
export type AtajoPeriodo = (typeof ATAJOS_PERIODO)[number];

export function esAtajoPeriodo(v: string): v is AtajoPeriodo {
  return (ATAJOS_PERIODO as readonly string[]).includes(v);
}

const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function esRangoValido(valor: string): boolean {
  const [desde, hasta, ...resto] = valor.split("..");
  if (resto.length || !desde || !hasta || !FECHA.test(desde) || !FECHA.test(hasta)) return false;
  if (!existe(desde) || !existe(hasta)) return false;
  return desde <= hasta;
}

/** El regex deja pasar "2026-02-31"; acá se comprueba que el día exista de verdad. */
function existe(dia: string): boolean {
  return new Date(`${dia}T00:00:00Z`).toISOString().startsWith(dia);
}

export const ETIQUETAS_PERIODO: Record<AtajoPeriodo, string> = {
  hoy: "Hoy",
  "esta-semana": "Esta semana",
  "semana-pasada": "Semana pasada",
  "este-mes": "Este mes",
  "mes-pasado": "Mes pasado",
  "ultimos-3-meses": "Últimos 3 meses",
  "este-anio": "Este año",
  "anio-pasado": "Año pasado",
};

/** Argentina no usa horario de verano desde 2009: el offset es fijo. */
const OFFSET = "-03:00";
const ZONA = "America/Argentina/Buenos_Aires";

export function hoyEnBuenosAires(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
/** Día calendario en UTC puro (sin hora) para hacer cuentas de fechas sin husos. */
function ymd(y: number, m0: number, d: number): string {
  const t = new Date(Date.UTC(y, m0, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
function inicio(dia: string): Date {
  return new Date(`${dia}T00:00:00.000${OFFSET}`);
}
function fin(dia: string): Date {
  return new Date(`${dia}T23:59:59.999${OFFSET}`);
}

export function resolverPeriodo(valor: string, hoyYmd: string): RangoFechas | null {
  if (esRangoValido(valor)) {
    const [d, h] = valor.split("..");
    return { desde: inicio(d), hasta: fin(h) };
  }
  if (!esAtajoPeriodo(valor)) return null;
  const [y, m, d] = hoyYmd.split("-").map(Number);
  const m0 = m - 1;
  // Lunes = 0 … domingo = 6.
  const diaSemana = (new Date(Date.UTC(y, m0, d)).getUTCDay() + 6) % 7;
  switch (valor) {
    case "hoy":
      return { desde: inicio(hoyYmd), hasta: fin(hoyYmd) };
    case "esta-semana":
      return { desde: inicio(ymd(y, m0, d - diaSemana)), hasta: fin(ymd(y, m0, d - diaSemana + 6)) };
    case "semana-pasada":
      return { desde: inicio(ymd(y, m0, d - diaSemana - 7)), hasta: fin(ymd(y, m0, d - diaSemana - 1)) };
    case "este-mes":
      return { desde: inicio(ymd(y, m0, 1)), hasta: fin(ymd(y, m0 + 1, 0)) };
    case "mes-pasado":
      return { desde: inicio(ymd(y, m0 - 1, 1)), hasta: fin(ymd(y, m0, 0)) };
    case "ultimos-3-meses":
      return { desde: inicio(ymd(y, m0 - 2, 1)), hasta: fin(ymd(y, m0 + 1, 0)) };
    case "este-anio":
      return { desde: inicio(ymd(y, 0, 1)), hasta: fin(ymd(y, 11, 31)) };
    case "anio-pasado":
      return { desde: inicio(ymd(y - 1, 0, 1)), hasta: fin(ymd(y - 1, 11, 31)) };
  }
}

function dma(dia: string) {
  const [y, m, d] = dia.split("-");
  return `${d}/${m}/${y}`;
}

export function etiquetaPeriodo(valor: string): string {
  if (esAtajoPeriodo(valor)) return ETIQUETAS_PERIODO[valor];
  const [d, h] = valor.split("..");
  return `${dma(d)} al ${dma(h)}`;
}
