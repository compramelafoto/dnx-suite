/**
 * Fechas de la agenda (Etapa 4, Entrega B). Módulo PURO. Las citas se guardan como instantes UTC y se
 * muestran en `America/Argentina/Buenos_Aires` (UTC−3 todo el año). Una cita de todo el día ocupa desde
 * las 00:00 de Argentina hasta las 00:00 del día siguiente. Los días se escriben "YYYY-MM-DD".
 */
import { diaArgentina, fechaValida, sumarDias } from "@/lib/proyectos/fechas";
import { DESFASE_ARGENTINA_HORAS, DURACION_MINUTOS_POR_OMISION } from "./constantes";

export { diaArgentina, fechaValida, sumarDias };

const HORA = /^([0-2][0-9]):([0-5][0-9])$/;

/** "HH:MM" válido (00:00 a 23:59) → minutos desde medianoche; null si no lo es. */
export function minutosDeHora(hora: string | null | undefined): number | null {
  if (typeof hora !== "string") return null;
  const m = HORA.exec(hora.trim());
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return h * 60 + Number(m[2]);
}

/** El instante UTC de una hora de Argentina de un día. */
export function instanteArgentina(dia: string, minutos = 0): Date {
  const f = fechaValida(dia);
  if (f === null) throw new RangeError(`Fecha inválida: ${dia}`);
  const [a, m, d] = f.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, DESFASE_ARGENTINA_HORAS, minutos));
}

/** Las 00:00 de Argentina de un día. */
export function inicioDelDia(dia: string): Date {
  return instanteArgentina(dia, 0);
}

export type CitaCalculada = { startAt: Date; endAt: Date; allDay: boolean };

/**
 * Inicio y fin de la cita que genera una regla de producto: día del evento + `daysFromEvent`. Con hora
 * (`HH:MM` de Argentina) dura `durationMinutes`; sin hora (o con una inválida) ocupa el día entero.
 */
export function citaDesdeRegla(
  fechaEvento: string,
  daysFromEvent: number,
  startTime: string | null,
  durationMinutes: number,
): CitaCalculada {
  const dia = sumarDias(fechaEvento, Number.isInteger(daysFromEvent) ? daysFromEvent : 0);
  const minutos = minutosDeHora(startTime);
  if (minutos === null) {
    return { startAt: inicioDelDia(dia), endAt: inicioDelDia(sumarDias(dia, 1)), allDay: true };
  }
  const duracion = Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.trunc(durationMinutes) : DURACION_MINUTOS_POR_OMISION;
  const startAt = instanteArgentina(dia, minutos);
  return { startAt, endAt: new Date(startAt.getTime() + duracion * 60_000), allDay: false };
}

/** Una cita de todo el día a partir de un día (para entregas, cumpleaños, vencimientos). */
export function todoElDia(dia: string): { startAt: Date; endAt: Date } {
  return { startAt: inicioDelDia(dia), endAt: inicioDelDia(sumarDias(dia, 1)) };
}

export type VistaAgenda = "dia" | "semana" | "mes";

export type RangoVista = {
  vista: VistaAgenda;
  /** Primer día (inclusive) y último día (inclusive) que muestra la vista. */
  desdeDia: string;
  hastaDia: string;
  /** Instante de inicio (inclusive) y de fin (exclusive) de ese rango. */
  desde: Date;
  hasta: Date;
};

/** 0 = lunes … 6 = domingo. */
export function diaDeSemana(dia: string): number {
  const f = fechaValida(dia);
  if (f === null) throw new RangeError(`Fecha inválida: ${dia}`);
  return (new Date(`${f}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function rango(vista: VistaAgenda, desdeDia: string, hastaDia: string): RangoVista {
  return { vista, desdeDia, hastaDia, desde: inicioDelDia(desdeDia), hasta: inicioDelDia(sumarDias(hastaDia, 1)) };
}

export function rangoDia(dia: string): RangoVista {
  return rango("dia", dia, dia);
}

/** La semana (lunes a domingo) que contiene el día. */
export function rangoSemana(dia: string): RangoVista {
  const lunes = sumarDias(dia, -diaDeSemana(dia));
  return rango("semana", lunes, sumarDias(lunes, 6));
}

/** El mes que contiene el día, completo (1 al último). */
export function rangoMes(dia: string): RangoVista {
  const f = fechaValida(dia);
  if (f === null) throw new RangeError(`Fecha inválida: ${dia}`);
  const primero = `${f.slice(0, 8)}01`;
  const [a, m] = [Number(f.slice(0, 4)), Number(f.slice(5, 7))];
  const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  return rango("mes", primero, ultimo);
}

/** La grilla de un mes: de lunes a domingo, con los días de los meses vecinos que completan las semanas. */
export function rangoGrillaMes(dia: string): RangoVista {
  const mes = rangoMes(dia);
  const desde = sumarDias(mes.desdeDia, -diaDeSemana(mes.desdeDia));
  const hasta = sumarDias(mes.hastaDia, 6 - diaDeSemana(mes.hastaDia));
  return rango("mes", desde, hasta);
}

export function rangoDeVista(vista: VistaAgenda, dia: string): RangoVista {
  if (vista === "dia") return rangoDia(dia);
  if (vista === "semana") return rangoSemana(dia);
  return rangoGrillaMes(dia);
}

/** Los días (inclusive) de un rango, de a uno. */
export function diasDelRango(r: Pick<RangoVista, "desdeDia" | "hastaDia">): string[] {
  const out: string[] = [];
  for (let d = r.desdeDia; d <= r.hastaDia && out.length < 400; d = sumarDias(d, 1)) out.push(d);
  return out;
}

/** Mueve la vista hacia atrás (-1) o adelante (+1) y devuelve el día de referencia nuevo. */
export function moverVista(vista: VistaAgenda, dia: string, pasos: number): string {
  if (vista === "dia") return sumarDias(dia, pasos);
  if (vista === "semana") return sumarDias(dia, 7 * pasos);
  const f = fechaValida(dia);
  if (f === null) throw new RangeError(`Fecha inválida: ${dia}`);
  const base = new Date(Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1 + pasos, 1));
  const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(Number(f.slice(8, 10)), ultimo));
  return base.toISOString().slice(0, 10);
}

/** ¿La cita [inicio, fin) toca el rango [desde, hasta)? */
export function seSuperpone(inicio: Date, fin: Date, desde: Date, hasta: Date): boolean {
  return inicio.getTime() < hasta.getTime() && fin.getTime() > desde.getTime();
}

/** Los días de Argentina que ocupa [inicio, fin) (fin exclusive: una cita que termina a las 00:00 no suma ese día). */
export function diasQueOcupa(inicio: Date, fin: Date): string[] {
  const primero = diaArgentina(inicio);
  const ultimoInstante = new Date(Math.max(inicio.getTime(), fin.getTime() - 1));
  const ultimo = diaArgentina(ultimoInstante);
  return diasDelRango({ desdeDia: primero, hastaDia: ultimo });
}
