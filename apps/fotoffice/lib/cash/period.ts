/**
 * Atajos de período para el reporte de Caja. Módulo PURO: sin base y sin red.
 *
 * Recibe el día de hoy como parámetro en vez de leer `new Date()` adentro: así una prueba no
 * depende del día en que corre ni de la zona horaria de la máquina que la ejecuta, y quien
 * llama decide una sola vez qué es "hoy" en vez de que cada rama de este archivo lo resuelva
 * por su cuenta.
 */

export const PERIOD_SHORTCUTS = ["este-mes", "mes-pasado", "ultimos-30"] as const;
export type PeriodShortcut = (typeof PERIOD_SHORTCUTS)[number];

export type PeriodRange = {
  /** "YYYY-MM-DD", inclusive. */
  from: string;
  /** "YYYY-MM-DD", inclusive. */
  to: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Arma la fecha en UTC a mediodía: evita que un huso corra el día al formatear de vuelta. */
function utcYmd(year: number, monthIndex: number, day: number): string {
  const d = new Date(Date.UTC(year, monthIndex, day));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** ¿Es uno de los atajos válidos? Sirve para no confiar en un `searchParams` que viene de la URL. */
export function esPeriodShortcut(value: string | undefined): value is PeriodShortcut {
  return !!value && (PERIOD_SHORTCUTS as readonly string[]).includes(value);
}

/**
 * Resuelve un atajo a un rango concreto, las dos puntas incluidas.
 *
 * `todayYmd` es "hoy" en "YYYY-MM-DD", en la zona de la institución: la decide quien llama
 * (ver `hoyYmd` en la pantalla), no esta función.
 */
export function resolvePeriodShortcut(shortcut: PeriodShortcut, todayYmd: string): PeriodRange {
  const [year, month, day] = todayYmd.split("-").map(Number);

  switch (shortcut) {
    case "este-mes":
      return {
        from: utcYmd(year, month - 1, 1),
        // Día 0 del mes siguiente es el último día del mes en curso.
        to: utcYmd(year, month, 0),
      };
    case "mes-pasado":
      return {
        from: utcYmd(year, month - 2, 1),
        to: utcYmd(year, month - 1, 0),
      };
    case "ultimos-30":
      return {
        // Incluye hoy: hoy menos 29 días son 30 fechas en total.
        from: utcYmd(year, month - 1, day - 29),
        to: todayYmd,
      };
  }
}
