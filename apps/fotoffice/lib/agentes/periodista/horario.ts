/**
 * Horarios del Periodista en hora argentina (UTC-3 todo el año: Argentina no tiene horario de
 * verano). Módulo PURO.
 */

const DESFASE_AR_MS = 3 * 60 * 60 * 1000;
/** Hora (argentina) a la que sale publicada una nota aprobada. */
export const HORA_PUBLICACION_AR = 11;

/** El día calendario argentino de un instante, "AAAA-MM-DD". */
export function diaArgentino(instante: Date): string {
  return new Date(instante.getTime() - DESFASE_AR_MS).toISOString().slice(0, 10);
}

/** Las 0:00 argentinas del día de `instante`, como instante UTC (03:00 UTC). */
export function inicioDelDiaArgentino(instante: Date): Date {
  return new Date(`${diaArgentino(instante)}T03:00:00.000Z`);
}

/**
 * Cuándo se publica una nota aprobada en `ahora`: ese día a las 11:00 argentinas (14:00 UTC), o
 * enseguida si ya pasaron.
 */
export function horaDePublicacion(ahora: Date): Date {
  const once = new Date(inicioDelDiaArgentino(ahora).getTime() + HORA_PUBLICACION_AR * 60 * 60 * 1000);
  return once.getTime() > ahora.getTime() ? once : new Date(ahora.getTime());
}

/** "hoy a las 11:00" o "ahora", para contarle a Daniel qué pasó. */
export function textoDePublicacion(publicacion: Date, ahora: Date): string {
  return publicacion.getTime() > ahora.getTime() + 60_000 ? "hoy a las 11:00" : "ahora mismo";
}

/** "lunes 9/11, 9:00" en hora argentina, para la página de super admin. */
export function fechaHoraArgentina(instante: Date): string {
  const d = new Date(instante.getTime() - DESFASE_AR_MS);
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const hh = d.getUTCHours();
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dias[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}, ${hh}:${mm}`;
}
