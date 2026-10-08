/**
 * Fechas de un proyecto (Etapa 4, Entrega A). Módulo PURO. Todas las fechas son "YYYY-MM-DD" del
 * calendario de Argentina (`America/Argentina/Buenos_Aires`); la aritmética es de calendario, sin husos.
 *
 * - fecha base = día del evento del pedido o, si no tiene, el día de la confirmación;
 * - el plan de cada etapa es la fecha base + la suma de los días de las etapas 1..i del flujo;
 * - el vencimiento de una tarea modelo es el plan de su etapa + los días de la tarea;
 * - el atraso son los días entre el plan de la etapa actual y hoy, si es positivo.
 */
import { HUSO_HORARIO } from "./constantes";

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Valida y devuelve "YYYY-MM-DD", o null si no es una fecha de calendario real. */
export function fechaValida(fecha: string | Date | null | undefined): string | null {
  if (fecha === null || fecha === undefined) return null;
  // Una columna `@db.Date` llega como medianoche UTC: su día es el de calendario.
  if (fecha instanceof Date) return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString().slice(0, 10);
  const t = fecha.trim();
  const m = FECHA.exec(t);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === t ? t : null;
}

/** El día (Argentina) en que cae un instante. */
export function diaArgentina(instante: Date): string {
  if (Number.isNaN(instante.getTime())) throw new RangeError("Instante inválido");
  // "en-CA" formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: HUSO_HORARIO, year: "numeric", month: "2-digit", day: "2-digit" }).format(instante);
}

/** Suma días (enteros, también negativos) a una fecha "YYYY-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  const f = fechaValida(fecha);
  if (f === null) throw new RangeError(`Fecha inválida: ${fecha}`);
  const m = FECHA.exec(f)!;
  const n = Number.isFinite(dias) ? Math.trunc(dias) : 0;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n)).toISOString().slice(0, 10);
}

/** Días de calendario entre dos fechas (`hasta` − `desde`). */
export function diasEntre(desde: string, hasta: string): number {
  const a = fechaValida(desde);
  const b = fechaValida(hasta);
  if (a === null || b === null) throw new RangeError("Fecha inválida");
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Fecha base del proyecto: el día del evento, o el de la confirmación (Argentina) si no hay evento. */
export function fechaBase(eventDate: string | Date | null, confirmadoEn: Date): string {
  return fechaValida(eventDate) ?? diaArgentina(confirmadoEn);
}

export type EtapaParaPlan = { id: string; days: number };
export type PlanDeEtapa = { stageId: string; plannedDueDate: string };

/**
 * Vencimiento planificado de cada etapa, en el orden recibido (el del flujo): acumula los días. Una
 * etapa con 0 días (sin vencimiento propio) vence el mismo día que la anterior. Días no enteros o
 * negativos cuentan como 0.
 */
export function planDeEtapas(etapas: readonly EtapaParaPlan[], base: string): PlanDeEtapa[] {
  let acumulado = 0;
  return etapas.map((e) => {
    acumulado += Number.isInteger(e.days) && e.days > 0 ? e.days : 0;
    return { stageId: e.id, plannedDueDate: sumarDias(base, acumulado) };
  });
}

/** Vencimiento de una tarea modelo: el plan de su etapa + los días de la tarea. */
export function vencimientoDeTarea(planDeLaEtapa: string, diasDeLaTarea: number): string {
  return sumarDias(planDeLaEtapa, Number.isInteger(diasDeLaTarea) ? diasDeLaTarea : 0);
}

/** Atraso en días: cuánto pasó del vencimiento planificado hasta hoy; 0 si no hay o no se pasó. */
export function atraso(plannedDueDate: string | Date | null, hoy: string | Date): number {
  const plan = fechaValida(plannedDueDate);
  const h = fechaValida(hoy);
  if (plan === null || h === null) return 0;
  return Math.max(0, diasEntre(plan, h));
}
