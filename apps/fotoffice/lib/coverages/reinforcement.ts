import type { CoverageSettingsShape } from "./settings";

export type Reinforcement = {
  /** Cuántas personas conviene tener en total. */
  recommended: number;
  /** Por qué, en una frase que se muestra tal cual. */
  reason: string;
};

/**
 * "Esta cobertura es larga: convendría sumar a alguien."
 *
 * **Recomienda, no bloquea.** El coordinador conoce la actividad y puede tener razones para ir
 * con una sola persona; lo que no puede es no haberse enterado. Cuando decide seguir igual, la
 * pantalla le pide una observación que queda en el historial.
 *
 * Devuelve `null` cuando no hay nada que decir, así quien la usa muestra el aviso o no sin
 * preguntar por un booleano aparte.
 */
export function recomendarRefuerzo(input: {
  durationMinutes: number;
  assigned: number;
  settings: CoverageSettingsShape;
}): Reinforcement | null {
  const { durationMinutes, assigned, settings } = input;

  // Las fechas las carga una persona y pueden llegar dadas vuelta o vacías. Un aviso calculado
  // sobre una duración negativa sería peor que no avisar.
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;

  const umbral = settings.reinforcementThresholdMinutes;
  if (durationMinutes <= umbral) return null;

  const recomendados = settings.recommendedCollaborators;
  if (assigned >= recomendados) return null;

  return {
    recommended: recomendados,
    reason: `La cobertura dura ${formatearDuracion(durationMinutes)} y supera el umbral de ${formatearDuracion(umbral)}.`,
  };
}

/**
 * "4 h 30", "3 h", "45 min".
 *
 * Se escribe así y no en minutos porque el aviso lo lee una persona que está mirando el
 * horario del evento, no un informe.
 */
export function formatearDuracion(minutos: number): string {
  const total = Math.round(minutos);
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${String(resto).padStart(2, "0")}`;
}
