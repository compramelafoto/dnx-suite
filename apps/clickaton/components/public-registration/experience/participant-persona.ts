/**
 * Personalización de UX solo con señales de frontend.
 * - Pack activo: `passCredits` del contexto público (ya resuelto en servidor).
 * - Returning: marca local tras una inscripción exitosa en este dispositivo.
 */

export type ParticipantPersona = "new" | "returning" | "pack_holder";

const RETURNING_STORAGE_KEY = "ck_reg_returning_participant";

export function markReturningParticipant(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RETURNING_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function readReturningParticipantFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(RETURNING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function resolveParticipantPersona(input: {
  hasActivePassCredits: boolean;
  isReturningLocal: boolean;
}): ParticipantPersona {
  if (input.hasActivePassCredits) return "pack_holder";
  if (input.isReturningLocal) return "returning";
  return "new";
}
