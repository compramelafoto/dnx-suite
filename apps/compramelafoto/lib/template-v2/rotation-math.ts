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
