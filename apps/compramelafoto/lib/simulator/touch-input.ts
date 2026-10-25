/**
 * Controles de celular: el joystick y el arrastre para mirar escriben acá y el
 * controlador de primera persona lo lee en cada cuadro (como con el teclado y
 * el mouse en la computadora).
 */

export interface TouchInput {
  /** Hay controles táctiles en pantalla (la navegación está siempre activa). */
  active: boolean;
  /** Joystick: −1…1 (x a la derecha, y hacia adelante). */
  moveX: number;
  moveY: number;
  /** Arrastre para mirar acumulado desde el último cuadro (px). */
  lookDX: number;
  lookDY: number;
}

export const touchInput: TouchInput = { active: false, moveX: 0, moveY: 0, lookDX: 0, lookDY: 0 };

/** Joystick llevado casi al borde: se corre. */
export const TOUCH_SPRINT_THRESHOLD = 0.92;

/** Lleva el desplazamiento del dedo (px) a un valor de joystick dentro del círculo. */
export function joystickVector(dx: number, dy: number, radius: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6 || radius <= 0) return { x: 0, y: 0 };
  const k = Math.min(len, radius) / len / radius;
  // En pantalla y crece hacia abajo; adelante es hacia arriba.
  return { x: dx * k, y: -dy * k };
}

/**
 * ¿Es un teléfono o tableta (pantalla táctil sin mouse)? `?tactil=1` lo fuerza
 * para probar en la computadora.
 */
export function isTouchGameDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("tactil") === "1") return true;
  return window.matchMedia("(pointer: coarse)").matches && navigator.maxTouchPoints > 0;
}

/** Simula una tecla para reusar los atajos de teclado del simulador (obturar, foco, zoom…). */
export function sendSimulatorKey(code: string, type: "keydown" | "keyup" = "keydown") {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
}

/** Toque corto de una tecla. */
export function tapSimulatorKey(code: string) {
  sendSimulatorKey(code, "keydown");
  sendSimulatorKey(code, "keyup");
}
