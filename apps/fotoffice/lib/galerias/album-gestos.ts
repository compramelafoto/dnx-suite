/** Reglas PURAS de los gestos del visor de álbum. */
export const UMBRAL_DESLIZAR = 50;

/** ¿Un arrastre de (dx, dy) es un deslizar horizontal que cambia de lámina? Nunca con la cajita abierta ni si empezó dentro de ella. */
export function direccionDeDeslizar(dx: number, dy: number, cajaAbierta: boolean, empezoEnCaja: boolean): -1 | 0 | 1 {
  if (cajaAbierta || empezoEnCaja) return 0;
  if (![dx, dy].every(Number.isFinite)) return 0;
  if (Math.abs(dx) < UMBRAL_DESLIZAR || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

/** Posición de la cajita: debajo del punto si está arriba, encima si no; null = usar el panel inferior (pantallas chicas). */
export function ubicarCaja(cajaAncho: number, cajaAlto: number, ancla: { left: number; top: number }, anchoMax = 288): { width: number; left: number; top?: number; bottom?: number } | null {
  if (cajaAncho < 480) return null;
  const width = Math.max(0, Math.min(anchoMax, cajaAncho - 8));
  const left = Math.min(Math.max(ancla.left - width / 2, 4), Math.max(4, cajaAncho - width - 4));
  return ancla.top < cajaAlto * 0.55 ? { width, left, top: ancla.top + 18 } : { width, left, bottom: cajaAlto - ancla.top + 18 };
}
