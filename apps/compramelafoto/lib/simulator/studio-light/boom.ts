import type { StudioLight } from "./types";

/**
 * Dónde va el pie cuando la luz cuelga de una jirafa (desplazamiento x, z en m),
 * o null si va en un pie común.
 * - Luz frontal cerca del eje de cámara (mariposa, clamshell): el pie taparía la cara.
 * - Luz cenital, sobre el sujeto: un pie común le atravesaría la cabeza.
 */
export function boomOffset(light: StudioLight): { x: number; z: number } | null {
  const side = light.x >= 0 ? 1 : -1;
  const overSubject = Math.hypot(light.x, light.z) < 0.95 && light.y > 1.8;
  if (overSubject) return { x: side * 1.3, z: -0.1 };
  const frontal = light.z >= 0.25 && light.y >= 1.3 && Math.abs(Math.atan2(light.x, light.z)) < (28 * Math.PI) / 180;
  return frontal ? { x: side * 0.95, z: 0.15 } : null;
}
