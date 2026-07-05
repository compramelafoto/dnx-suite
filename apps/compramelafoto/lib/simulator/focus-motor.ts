/**
 * Velocidad del motor de enfoque AF-S (simulación pedagógica).
 */

/** Metros por segundo del barrido a velocidad “base”. */
export const FOCUS_MOTOR_METERS_PER_SECOND_BASE = 6;

/** Factor de ralentización (1.5 = 50 % más lento). */
export const FOCUS_MOTOR_SLOWDOWN = 1.5;

export const FOCUS_MOTOR_METERS_PER_SECOND =
  FOCUS_MOTOR_METERS_PER_SECOND_BASE / FOCUS_MOTOR_SLOWDOWN;

export const FOCUS_MOTOR_MIN_DURATION_MS = 160;
export const FOCUS_MOTOR_MAX_DURATION_MS = 2200;

/** Duración del barrido según distancia recorrida. */
export function focusMotorDurationMs(fromM: number, toM: number): number {
  const delta = Math.abs(toM - fromM);
  if (delta < 0.02) return FOCUS_MOTOR_MIN_DURATION_MS;
  const raw = (delta / FOCUS_MOTOR_METERS_PER_SECOND) * 1000;
  return Math.min(FOCUS_MOTOR_MAX_DURATION_MS, Math.max(FOCUS_MOTOR_MIN_DURATION_MS, raw));
}

/** Desaceleración al final del recorrido (motor que frena). */
export function focusMotorEase(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - (1 - clamped) ** 3;
}

export function interpolateFocusDistance(
  fromM: number,
  toM: number,
  progress01: number,
): number {
  const eased = focusMotorEase(progress01);
  return fromM + (toM - fromM) * eased;
}
