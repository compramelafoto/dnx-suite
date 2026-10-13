/** Convención: mismos grados que CSS `rotate()`; se guarda normalizado en (-180, 180]. */
export function normalizeRotationDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  let x = deg % 360;
  if (x > 180) x -= 360;
  if (x <= -180) x += 360;
  return x;
}

/** Diferencia entre dos ángulos en radianes, en (-π, π] (evita saltos al arrastrar). */
export function unwrapAngleDeltaRad(fromRad: number, toRad: number): number {
  let d = toRad - fromRad;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Con Shift, cuántos grados atrae un ángulo recto (0°, 90°, 180°, 270°). */
export const ROTATION_RIGHT_ANGLE_MAGNET_DEG = 10;
/** Con Shift, el paso fijo entre ángulos rectos. */
export const ROTATION_SHIFT_STEP_DEG = 15;

/**
 * Rotación con imán (tecla Shift): cerca de un ángulo recto se pega a él; en el resto avanza de
 * a 15°. Devuelve el ángulo normalizado, listo para guardar.
 */
export function snapRotationDeg(deg: number): number {
  const d = normalizeRotationDeg(deg);
  const recto = Math.round(d / 90) * 90;
  if (Math.abs(d - recto) <= ROTATION_RIGHT_ANGLE_MAGNET_DEG) return normalizeRotationDeg(recto);
  return normalizeRotationDeg(Math.round(d / ROTATION_SHIFT_STEP_DEG) * ROTATION_SHIFT_STEP_DEG);
}
