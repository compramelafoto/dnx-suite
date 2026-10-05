/**
 * Cuándo sale el resumen semanal. Módulo puro.
 *
 * Los lunes desde las 9:00 hora argentina. Argentina no tiene horario de verano: UTC−3 fijo.
 * La semana se identifica con el formato ISO (2026-W41), que es lo que va en `dedupeKey`.
 */

const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
export const DIGEST_HOUR_AR = 9;

/** La fecha y hora "de pared" en Argentina, como si fuera UTC (para leer día y hora). */
function argentinaWall(now: Date): Date {
  return new Date(now.getTime() - AR_OFFSET_MS);
}

export function isDigestWindow(now: Date): boolean {
  const ar = argentinaWall(now);
  return ar.getUTCDay() === 1 && ar.getUTCHours() >= DIGEST_HOUR_AR;
}

/** Semana ISO de la fecha argentina: "2026-W41". */
export function isoWeekKey(now: Date): string {
  const ar = argentinaWall(now);
  const d = new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const DIGEST_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
