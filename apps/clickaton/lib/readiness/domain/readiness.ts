/**
 * De cuatro medidas a un veredicto de "tu teléfono está listo".
 *
 * Puro a propósito: el mismo veredicto se dibuja en el navegador y se guarda
 * en la base. Si la regla viviera en los dos lados, un día la pantalla dice
 * "listo" y la fila guardada dice "sin GPS".
 *
 * El reloj se compara contra la hora del SERVIDOR. Comparar contra la hora
 * del navegador no detectaría nada: es el mismo teléfono que escribió el EXIF.
 */

export type ReadinessMeasurements = {
  /** Si el EXIF trae coordenadas. */
  hasGps: boolean;
  /** Hora de captura del EXIF en milisegundos, o null si el EXIF no la trae. */
  captureAtMs: number | null;
  width: number;
  height: number;
};

export type ReadinessLimits = {
  toleranceMinutes: number;
  minWidth: number;
  minHeight: number;
};

export type ReadinessResult =
  | "READY"
  | "NO_GPS"
  | "CLOCK_OFF"
  | "TOO_SMALL"
  | "NO_CAPTURE_DATE"
  | "FAILED";

export type ReadinessVerdict = {
  /** El problema más importante, o READY. */
  result: ReadinessResult;
  /** Positivo = el teléfono va adelantado. Null si no hubo fecha de captura. */
  clockDeltaMinutes: number | null;
  /** Todos los problemas encontrados, para poder arreglarlos de una vez. */
  problems: ReadinessResult[];
};

/** Orden de importancia: sin GPS no sirve para el mapa, que es el punto. */
const PRIORIDAD: ReadinessResult[] = [
  "FAILED",
  "NO_GPS",
  "NO_CAPTURE_DATE",
  "CLOCK_OFF",
  "TOO_SMALL",
];

export function evaluateReadiness(input: {
  measurements: ReadinessMeasurements;
  limits: ReadinessLimits;
  serverNowMs: number;
}): ReadinessVerdict {
  const { measurements: m, limits, serverNowMs } = input;
  const problems: ReadinessResult[] = [];

  // Una imagen que no se pudo medir no se puede juzgar por lo demás.
  if (!Number.isFinite(m.width) || !Number.isFinite(m.height) || m.width <= 0 || m.height <= 0) {
    return { result: "FAILED", clockDeltaMinutes: null, problems: ["FAILED"] };
  }

  if (!m.hasGps) problems.push("NO_GPS");

  let clockDeltaMinutes: number | null = null;
  if (m.captureAtMs === null) {
    problems.push("NO_CAPTURE_DATE");
  } else {
    clockDeltaMinutes = Math.round((m.captureAtMs - serverNowMs) / 60_000);
    if (Math.abs(clockDeltaMinutes) > limits.toleranceMinutes) {
      problems.push("CLOCK_OFF");
    }
  }

  // Eje por eje, exactamente como la cañería real del concurso: en
  // `lib/photo-upload/service.ts` el rechazo es
  // `width < ctx.config.minWidth || height < ctx.config.minHeight`.
  //
  // Toda la utilidad de esta pantalla es predecir el veredicto del 12/12. Una
  // regla propia — por ejemplo ordenar los lados y compararlos contra los
  // mínimos ordenados — le diría "listo" a una foto de 700×2000 que el día
  // del evento se rechaza. Si algún día la cañería pasa a ser indiferente a
  // la orientación, se cambia allá primero y acá después.
  if (m.width < limits.minWidth || m.height < limits.minHeight) {
    problems.push("TOO_SMALL");
  }

  const result =
    PRIORIDAD.find((p) => problems.includes(p)) ?? "READY";

  return { result, clockDeltaMinutes, problems };
}
