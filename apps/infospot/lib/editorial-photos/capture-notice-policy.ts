/**
 * Política pura de cooldown para el aviso global de "posible intento de
 * captura" (PrintScreen). Separada de PhotoCaptureNotice (que hace la
 * lectura/escritura real en sessionStorage) para poder testearla sin DOM
 * ni window.
 */

export type CaptureSignal = "contextmenu" | "dragstart" | "printscreen" | "visibilitychange";

/**
 * Solo señales de intención deliberada sobre una fotografía protegida
 * disparan el aviso legal. `visibilitychange` NUNCA acusa: perder la
 * visibilidad de la pestaña ocurre por motivos completamente benignos
 * (cambiar de pestaña, minimizar el navegador, abrir otra app, bloquear
 * el teléfono, atender una llamada, usar un selector de archivos, cambiar
 * de ventana) y no es evidencia de una captura de pantalla. Componentes
 * que reaccionan a estas señales deben consultar esta función en vez de
 * decidir por su cuenta, para que un cambio futuro no reintroduzca una
 * acusación falsa.
 */
export function isAccusatorySignal(signal: CaptureSignal): boolean {
  return signal !== "visibilitychange";
}

export const CAPTURE_NOTICE_COOLDOWN_MS = 30_000;
export const CAPTURE_NOTICE_MAX_PER_SESSION = 3;

export type CaptureNoticeState = { count: number; lastShownAt: number };

export const INITIAL_CAPTURE_NOTICE_STATE: CaptureNoticeState = { count: 0, lastShownAt: 0 };

/** true si corresponde mostrar el aviso ahora (no superó el máximo ni está en cooldown). */
export function shouldTriggerCaptureNotice(state: CaptureNoticeState, now: number): boolean {
  if (state.count >= CAPTURE_NOTICE_MAX_PER_SESSION) return false;
  if (now - state.lastShownAt < CAPTURE_NOTICE_COOLDOWN_MS) return false;
  return true;
}

export function nextCaptureNoticeState(state: CaptureNoticeState, now: number): CaptureNoticeState {
  return { count: state.count + 1, lastShownAt: now };
}
