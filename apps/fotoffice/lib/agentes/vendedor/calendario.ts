import { eventDayType } from "@repo/cuanto-cobro-core";
import { sumarDiasHabiles } from "../../impresiones/dias-habiles";
import { diaArgentino } from "../periodista/horario";
import type { AjustesVendedor } from "./ajustes";

/** Calendario de envío del Vendedor: días hábiles argentinos de 9:00 a 18:00. Módulo puro. */

export const HORA_INICIO_AR = 9;
export const HORA_FIN_AR = 18;
export const MAX_POR_CORRIDA = 2;
export const DIAS_HABILES_RECORDATORIO = 5;

const DESFASE_AR_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Lunes a viernes, sin feriados nacionales. `ymd` = "AAAA-MM-DD". */
export function esDiaHabil(ymd: string): boolean {
  const info = eventDayType(ymd);
  return !!info && !info.isSaturday && !info.isSunday && !info.nonWorkingDay && info.dayType !== "holiday";
}

function minutosArgentinos(ahora: Date): number {
  const d = new Date(ahora.getTime() - DESFASE_AR_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function enVentanaDeEnvio(ahora: Date): boolean {
  if (!esDiaHabil(diaArgentino(ahora))) return false;
  const m = minutosArgentinos(ahora);
  return m >= HORA_INICIO_AR * 60 && m < HORA_FIN_AR * 60;
}

/** Cupo total del día: 0 sin arranque; el de la primera semana si pasaron menos de 7 días desde `arrancoEn`. */
export function cupoDelDia(a: AjustesVendedor, ahora: Date): number {
  if (!a.arrancoEn) return 0;
  const dias = Math.round((Date.parse(`${diaArgentino(ahora)}T12:00:00Z`) - Date.parse(`${a.arrancoEn}T12:00:00Z`)) / DIA_MS);
  return dias < 7 ? a.correosPrimeraSemana : a.correosPorDia;
}

/** Cuánto del cupo ya se puede haber enviado a esta hora, repartido de las 9 a las 18. */
export function cupoHastaAhora(cupo: number, ahora: Date): number {
  const desdeLas9 = minutosArgentinos(ahora) - HORA_INICIO_AR * 60;
  if (desdeLas9 <= 0) return 0;
  const total = (HORA_FIN_AR - HORA_INICIO_AR) * 60;
  return Math.min(cupo, Math.ceil((cupo * desdeLas9) / total));
}

export function venceRecordatorio(enviadoEn: Date, ahora: Date): boolean {
  return diaArgentino(ahora) >= sumarDiasHabiles(diaArgentino(enviadoEn), DIAS_HABILES_RECORDATORIO);
}
