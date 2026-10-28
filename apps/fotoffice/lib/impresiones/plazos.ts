import { eventDayType } from "@repo/cuanto-cobro-core";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import type { Plazo } from "./catalogo-copias";
import { sumarDiasHabiles } from "./dias-habiles";

/**
 * Fecha que se le promete al cliente según el plazo (spec 2026-10-28 §2). Módulo PURO.
 * - INSTANTANEA: hoy (se imprime en el estudio).
 * - MANANA: el siguiente día hábil (sale al toque al laboratorio y se retira con un viaje especial).
 * - SEMANA: el estudio retira del laboratorio martes y viernes al mediodía y entrega esa tarde; se
 *   promete el primer martes o viernes no feriado cuyo mediodía quede al menos 48 h después del pago.
 */

const MARTES = 2;
const VIERNES = 5;
const ANTICIPACION_MS = 48 * 3_600_000;

function esDiaDeRetiro(ymd: string): boolean {
  const dia = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  if (dia !== MARTES && dia !== VIERNES) return false;
  const info = eventDayType(ymd);
  return !(info && (info.nonWorkingDay || info.dayType === "holiday"));
}

export function fechaPorPlazo(plazo: Plazo, pagado: Date): string {
  const hoy = diaEnBuenosAires(pagado);
  if (plazo === "INSTANTANEA") return hoy;
  if (plazo === "MANANA") return sumarDiasHabiles(hoy, 1);
  const d = new Date(`${hoy}T12:00:00Z`);
  for (let i = 0; i < 31; i++) {
    const ymd = d.toISOString().slice(0, 10);
    const mediodia = new Date(`${ymd}T12:00:00-03:00`);
    if (esDiaDeRetiro(ymd) && mediodia.getTime() - pagado.getTime() >= ANTICIPACION_MS) return ymd;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return sumarDiasHabiles(hoy, 5);
}
