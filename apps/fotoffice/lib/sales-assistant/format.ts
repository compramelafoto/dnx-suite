import { SALES_TIME_ZONE } from "./constants";

/**
 * Cómo se escriben las fechas y los filtros en las pantallas de `/ventas`.
 *
 * Módulo PURO y sin dependencias pesadas: lo importan también los componentes de cliente (la
 * tarjeta de la bandeja), así que no puede arrastrar zod ni nada del servidor.
 */

export const FILTROS_BANDEJA = ["HOY", "ESPERANDO", "PARA_CERRAR", "ARCHIVADAS"] as const;
export type FiltroBandeja = (typeof FILTROS_BANDEJA)[number];

export const ETIQUETA_FILTRO: Record<FiltroBandeja, string> = {
  HOY: "Para escribir hoy",
  ESPERANDO: "Esperando",
  PARA_CERRAR: "Para cerrar",
  ARCHIVADAS: "Archivadas",
};

/** El filtro de la URL, o HOY si no vino o no es uno de los cuatro. */
export function filtroDesdeUrl(valor: string | undefined): FiltroBandeja {
  const v = (valor ?? "").toUpperCase();
  return (FILTROS_BANDEJA as readonly string[]).includes(v) ? (v as FiltroBandeja) : "HOY";
}

const FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: SALES_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: SALES_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `26.09.2026`, en la hora de Argentina y no en la del servidor (Vercel corre en UTC). */
export function fechaVenta(d: Date): string {
  return FECHA.format(d).replace(/\//g, ".");
}

export function fechaHoraVenta(d: Date): string {
  return `${fechaVenta(d)}, ${HORA.format(d).replace(/^24:/, "00:")}`;
}

/** "hoy", "mañana", "en 12 días", "ayer", "hace 3 días". `dias` sale de `diasEntre`. */
export function textoEnDias(dias: number): string {
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  if (dias > 1) return `en ${dias} días`;
  return `hace ${-dias} días`;
}
