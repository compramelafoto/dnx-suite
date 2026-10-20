/**
 * Horas de la Bandeja siempre en hora argentina, esté donde esté el servidor o el navegador.
 * Módulo PURO.
 */
const ZONA = "America/Argentina/Buenos_Aires";

const dia = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
const hora = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "14:05" si es de hoy, "09/10 14:05" si no. */
export function horaDeLista(fecha: Date, ahora: Date = new Date()): string {
  const h = hora.format(fecha);
  return dia.format(fecha) === dia.format(ahora) ? h : `${dia.format(fecha).slice(0, 5)} ${h}`;
}

/** "09/10/2026 14:05". */
export function fechaYHora(fecha: Date): string {
  return `${dia.format(fecha)} ${hora.format(fecha)}`;
}

/** "14:05" */
export function soloHora(fecha: Date): string {
  return hora.format(fecha);
}

/** "09/10/2026" */
export function soloDia(fecha: Date): string {
  return dia.format(fecha);
}
