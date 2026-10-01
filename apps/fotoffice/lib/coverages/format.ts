import { COVERAGES_TIME_ZONE } from "./constants";

/**
 * Las fechas como se escriben acá: `26.09.2026`.
 *
 * El formato no es decorativo. Una fecha leída al revés —26 de septiembre contra 9 de junio—
 * manda a un fotógrafo el día equivocado a una actividad que no se repite.
 *
 * La zona se fija siempre y no se toma la del servidor: Vercel corre en UTC, y una cobertura
 * de las 21 h aparecería al día siguiente.
 */
const FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: COVERAGES_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: COVERAGES_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function fechaArgentina(date: Date): string {
  // `Intl` para es-AR devuelve "26/09/2026"; el diseño pide puntos.
  return FECHA.format(date).replace(/\//g, ".");
}

export function horaArgentina(date: Date): string {
  return HORA.format(date).replace(/^24:/, "00:");
}

export function fechaHoraArgentina(date: Date): string {
  return `${fechaArgentina(date)}, ${horaArgentina(date)}`;
}
