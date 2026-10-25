import { argentinaDay } from "@/lib/bot/dia-argentino";

/**
 * Día argentino (YYYY-MM-DD) de la primera comparativa "costo del bot vs ventas": el domingo 18/10/2026,
 * una semana después de abrir el bot a todos. Ese día se manda la comparativa de fin de semana;
 * después, sólo la mensual (el día 1 de cada mes, sobre el mes calendario anterior).
 */
export const PRIMERA_COMPARATIVA = "2026-10-18";
/** Día argentino en que el bot se abrió a todos: arranque del período de la comparativa de fin de semana. */
export const APERTURA_BOT = "2026-10-12";
/** Último día (inclusive) del período de la comparativa de fin de semana: el sábado anterior a la primera. */
export const CIERRE_PRIMERA = "2026-10-17";

export type TipoComparativa = "fin_de_semana" | "mensual";

/**
 * Período en días argentinos. `desde` y `hasta` son inclusivos (sirven para `BotUsageDaily.day`);
 * `inicio` y `fin` son los instantes equivalentes (`fin` exclusivo) para comparar timestamps de Prisma (UTC).
 */
export type Periodo = { desde: string; hasta: string; inicio: Date; fin: Date; dias: number };

const DIA_MS = 24 * 60 * 60 * 1000;
/** Argentina no tiene horario de verano desde 2009: medianoche argentina = 03:00 UTC. */
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

function diaUtc(dia: string): number {
  const [y, m, d] = dia.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}
function aDia(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
/** Suma (o resta) días a un día YYYY-MM-DD. */
export function sumarDias(dia: string, n: number): string {
  return aDia(diaUtc(dia) + n * DIA_MS);
}
/** Instante de la medianoche argentina de ese día. */
export function inicioDiaArgentino(dia: string): Date {
  return new Date(diaUtc(dia) + AR_OFFSET_MS);
}

export function periodoEntre(desde: string, hasta: string): Periodo {
  const inicio = inicioDiaArgentino(desde);
  const fin = inicioDiaArgentino(sumarDias(hasta, 1));
  return { desde, hasta, inicio, fin, dias: Math.round((fin.getTime() - inicio.getTime()) / DIA_MS) };
}

/** Mes calendario argentino "YYYY-MM" desplazado `n` meses. */
export function sumarMeses(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1 + n, 1)).toISOString().slice(0, 7);
}
export function periodoMes(mes: string): Periodo {
  const desde = `${mes}-01`;
  const hasta = sumarDias(`${sumarMeses(mes, 1)}-01`, -1);
  return periodoEntre(desde, hasta);
}

/** Fin de semana: del 12/10 (apertura) al sábado 17/10, contra la misma cantidad de días justo antes. */
export function periodosFinDeSemana(): { actual: Periodo; anterior: Periodo } {
  const actual = periodoEntre(APERTURA_BOT, CIERRE_PRIMERA);
  const anterior = periodoEntre(sumarDias(APERTURA_BOT, -actual.dias), sumarDias(APERTURA_BOT, -1));
  return { actual, anterior };
}

/** Mensual: el mes argentino anterior a `now`, contra el mes previo y el promedio de los 3 meses previos. */
export function periodosMensuales(now: Date): { actual: Periodo; anterior: Periodo; previos: Periodo[] } {
  const mes = sumarMeses(argentinaDay(now).slice(0, 7), -1);
  return {
    actual: periodoMes(mes),
    anterior: periodoMes(sumarMeses(mes, -1)),
    previos: [1, 2, 3].map((n) => periodoMes(sumarMeses(mes, -n))),
  };
}

/**
 * Decide si hoy (día argentino) corresponde mandar la comparativa y cuál:
 * - el 18/10/2026 (`PRIMERA_COMPARATIVA`): la de fin de semana;
 * - el día 1 de cada mes: la mensual;
 * - cualquier otro día: nada (`null`), salvo que se fuerce para probar. Forzada sin tipo, manda la de
 *   fin de semana hasta fin de octubre de 2026 y la mensual después.
 */
export function decidirEnvio(now: Date, opciones: { forzar?: boolean; tipo?: TipoComparativa } = {}): TipoComparativa | null {
  const hoy = argentinaDay(now);
  if (opciones.forzar && opciones.tipo) return opciones.tipo;
  if (hoy === PRIMERA_COMPARATIVA) return "fin_de_semana";
  if (hoy.endsWith("-01")) return "mensual";
  if (opciones.forzar) return hoy < "2026-11-01" ? "fin_de_semana" : "mensual";
  return null;
}
