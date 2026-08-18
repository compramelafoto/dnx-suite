/**
 * Política pura de cooldown para el aviso global de "posible intento de
 * captura" (PrintScreen / visibilitychange). Separada de PhotoCaptureNotice
 * (que hace la lectura/escritura real en sessionStorage) para poder
 * testearla sin DOM ni window.
 */

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
