/**
 * Estados de un presupuesto y fechas de validez. Módulo PURO.
 *
 * - Las transiciones válidas viven acá (`puedePasar`): ningún cambio de estado se escribe sin
 *   pasar por esta tabla.
 * - `VENCIDO` se calcula al leer (`estadoEfectivo`): un presupuesto enviado o visto cuyo último
 *   día de validez ya pasó en Buenos Aires se ve vencido aunque la base todavía diga ENVIADO.
 *   "Marcar vencidos" (en lote) lo deja escrito.
 * - `validUntil` es una columna DATE: se guarda como medianoche UTC del día de calendario de
 *   Buenos Aires (así Prisma la escribe y la lee sin correr el día).
 */
import { ZONA_HORARIA, type EstadoPresupuesto } from "./constantes";

/** A qué estados se puede pasar desde cada uno. ACEPTADO es final. */
export const TRANSICIONES: Record<EstadoPresupuesto, readonly EstadoPresupuesto[]> = {
  BORRADOR: ["ENVIADO"],
  // ENVIADO → ENVIADO: se envió una versión nueva.
  ENVIADO: ["ENVIADO", "VISTO", "ACEPTADO", "RECHAZADO", "VENCIDO"],
  VISTO: ["ENVIADO", "ACEPTADO", "RECHAZADO", "VENCIDO"],
  // Vencido o rechazado: sólo vuelve a la vida con una versión nueva enviada.
  VENCIDO: ["ENVIADO", "RECHAZADO"],
  RECHAZADO: ["ENVIADO"],
  ACEPTADO: [],
};

export function puedePasar(de: EstadoPresupuesto, a: EstadoPresupuesto): boolean {
  return TRANSICIONES[de].includes(a);
}

/** Los estados que vencen solos cuando pasa la validez. */
export const ESTADOS_QUE_VENCEN: readonly EstadoPresupuesto[] = ["ENVIADO", "VISTO"];

/** Estados en los que el presupuesto ya no admite una versión nueva. */
export const ESTADOS_CERRADOS: readonly EstadoPresupuesto[] = ["ACEPTADO"];

const DIA_MS = 24 * 60 * 60 * 1000;
const diaBA = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit" });

/** "aaaa-mm-dd" de hoy (o de `ahora`) en Buenos Aires. */
export function diaEnBuenosAires(ahora: Date): string {
  return diaBA.format(ahora);
}

/** El día de hoy en Buenos Aires como valor de una columna DATE (medianoche UTC). */
export function hoyEnBuenosAires(ahora: Date): Date {
  return new Date(`${diaEnBuenosAires(ahora)}T00:00:00.000Z`);
}

/** Último día de validez: hoy (Buenos Aires) + `dias`. */
export function vencimientoDesde(ahora: Date, dias: number): Date {
  return new Date(hoyEnBuenosAires(ahora).getTime() + Math.max(0, Math.trunc(dias)) * DIA_MS);
}

/** "aaaa-mm-dd" de una columna DATE. */
export function textoDeFecha(fecha: Date | null): string | null {
  return fecha ? fecha.toISOString().slice(0, 10) : null;
}

/** ¿Ya pasó el último día de validez? El mismo día de `validUntil` todavía vale. */
export function vencio(validUntil: Date | null, ahora: Date): boolean {
  if (!validUntil) return false;
  return validUntil.getTime() < hoyEnBuenosAires(ahora).getTime();
}

/** El estado que se muestra: el guardado, salvo que esté enviado o visto y ya venció. */
export function estadoEfectivo(status: EstadoPresupuesto, validUntil: Date | null, ahora: Date): EstadoPresupuesto {
  return ESTADOS_QUE_VENCEN.includes(status) && vencio(validUntil, ahora) ? "VENCIDO" : status;
}
