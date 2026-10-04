/**
 * Cuánto vio un alumno de una clase.
 *
 * El reproductor informa cada `INTERVALO_REPORTE_SEGUNDOS` cuánto miró desde el reporte
 * anterior. El servidor **no le cree de más**: nunca suma más que el intervalo más una
 * tolerancia, ni más que el tiempo real que pasó desde el último reporte. Así arrastrar la
 * barra hasta el final, o mandar reportes a mano, no marca una clase como vista.
 */

export const INTERVALO_REPORTE_SEGUNDOS = 15;
/** Margen para la red y para el reloj del navegador. */
const TOLERANCIA_SEGUNDOS = 5;
/** Una clase está vista al 90% de su duración: nadie mira los créditos. */
export const UMBRAL_CLASE_COMPLETA = 0.9;

export type AvanceGuardado = {
  secondsWatched: number;
  lastPositionSeconds: number;
  lastReportAt: Date | null;
  completedAt: Date | null;
};

export type ReporteDeAvance = {
  positionSeconds: number;
  watchedSinceLastReport: number;
};

function numeroSano(valor: number): number {
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}

export function aplicarReporte(input: {
  previo: AvanceGuardado | null;
  reporte: ReporteDeAvance;
  ahora: Date;
  duracionSegundos: number | null;
}): AvanceGuardado {
  const previo: AvanceGuardado = input.previo ?? {
    secondsWatched: 0,
    lastPositionSeconds: 0,
    lastReportAt: null,
    completedAt: null,
  };
  const tope = INTERVALO_REPORTE_SEGUNDOS + TOLERANCIA_SEGUNDOS;
  const transcurrido = previo.lastReportAt
    ? Math.max(0, (input.ahora.getTime() - previo.lastReportAt.getTime()) / 1000)
    : tope;

  const suma = Math.floor(
    Math.min(numeroSano(input.reporte.watchedSinceLastReport), tope, transcurrido + TOLERANCIA_SEGUNDOS),
  );

  const duracion = input.duracionSegundos && input.duracionSegundos > 0 ? input.duracionSegundos : null;
  const visto = duracion
    ? Math.min(previo.secondsWatched + suma, duracion)
    : previo.secondsWatched + suma;
  const posicion = Math.floor(
    Math.min(numeroSano(input.reporte.positionSeconds), duracion ?? Number.MAX_SAFE_INTEGER),
  );

  const recienCompleta =
    duracion !== null && visto >= Math.ceil(duracion * UMBRAL_CLASE_COMPLETA) ? input.ahora : null;

  return {
    secondsWatched: visto,
    lastPositionSeconds: posicion,
    lastReportAt: input.ahora,
    completedAt: previo.completedAt ?? recienCompleta,
  };
}
