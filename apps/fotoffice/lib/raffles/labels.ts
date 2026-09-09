import type { RafflePrizeStatus, RaffleStatus } from "./constants";

/**
 * Cómo se nombra cada estado en pantalla.
 *
 * Módulo PURO. Existe por el mismo motivo que `lib/membership/charge-labels.ts`: los valores
 * que se guardan son para la base, no para leer. "PADRON_SELLADO" no le dice nada a nadie.
 */

const SORTEO: Record<RaffleStatus, string> = {
  BORRADOR: "Borrador",
  ANUNCIADO: "Anunciado, el padrón sigue abierto",
  PADRON_SELLADO: "Padrón cerrado, esperando el acto",
  SORTEADO: "Sorteado",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

const PREMIO: Record<RafflePrizeStatus, string> = {
  GANADO: "Ganado, falta avisarle",
  NOTIFICADO: "Avisado, falta que lo retire",
  RETIRADO: "Retirado",
  NO_RETIRADO: "No lo retiró",
  ANULADO: "Anulado",
};

export function raffleStatusLabel(status: string): string {
  return SORTEO[status as RaffleStatus] ?? status;
}

export function prizeStatusLabel(status: string): string {
  return PREMIO[status as RafflePrizeStatus] ?? status;
}

/**
 * Fecha y hora en la zona de la institución, para pantalla.
 *
 * `hour12: false` explícito: sin eso, `es-AR` devuelve "08:00 p. m." para las 20:00. Acá el
 * horario se dice de corrido —"el sorteo es a las 20"— y un "p. m." obliga a traducir.
 */
export function fechaHora(d: Date): string {
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Sólo la fecha. Para plazos de retiro, donde la hora no aporta. */
export function fechaCorta(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
