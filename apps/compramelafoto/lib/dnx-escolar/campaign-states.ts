/**
 * Estados de un prospecto de la campaña escolar y reglas de envío. «Enviado» sólo significa
 * que el proveedor aceptó el mensaje: no es «entregado» ni «leído».
 */

export const PROSPECT_STATES = [
  "PENDIENTE_VALIDACION",
  "LISTO",
  "ENVIANDO",
  "ENVIADO",
  "FALLIDO",
  "REBOTADO",
  "RESPONDIO",
  "NO_CONTACTAR",
] as const;
export type ProspectState = (typeof PROSPECT_STATES)[number];

export const PROSPECT_STATE_LABELS: Record<ProspectState, string> = {
  PENDIENTE_VALIDACION: "Pendiente de validación",
  LISTO: "Listo",
  ENVIANDO: "Enviando",
  ENVIADO: "Enviado (aceptado por el proveedor)",
  FALLIDO: "Fallido",
  REBOTADO: "Rebotado",
  RESPONDIO: "Respondió",
  NO_CONTACTAR: "No contactar",
};

/** Estados que bloquean cualquier envío futuro a ese email, en cualquier campaña. */
export const BLOCKING_STATES: ReadonlySet<ProspectState> = new Set(["REBOTADO", "NO_CONTACTAR"]);

export const MAX_SEND_ATTEMPTS = 3;
/** Un ENVIANDO más viejo que esto se considera abandonado y vuelve a LISTO. */
export const STALE_CLAIM_MS = 15 * 60 * 1000;

export function isProspectState(value: string): value is ProspectState {
  return (PROSPECT_STATES as readonly string[]).includes(value);
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Deja sólo dígitos; antepone 0341 a números locales de 7 dígitos. No cambia el número. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const first = String(raw ?? "").split(/[\/;]| - /)[0] ?? "";
  const digits = first.replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 7 ? `0341${digits}` : digits;
}

/**
 * Error del proveedor que conviene reintentar: límite de ritmo, error del servidor o de red.
 * Un 4xx distinto de 429 (dirección inválida, remitente no verificado) es definitivo.
 */
export function isTransientSendError(error: { statusCode?: number | null; name?: string | null }): boolean {
  const status = error.statusCode ?? null;
  if (status === 429) return true;
  if (status != null && status >= 500) return true;
  if (status == null) return true;
  return error.name === "rate_limit_exceeded" || error.name === "application_error";
}

export type SendFailureDecision = { status: ProspectState; retry: boolean };

export function decideAfterFailure(
  error: { statusCode?: number | null; name?: string | null },
  attemptsSoFar: number
): SendFailureDecision {
  const transient = isTransientSendError(error);
  if (transient && attemptsSoFar < MAX_SEND_ATTEMPTS) return { status: "LISTO", retry: true };
  return { status: "FALLIDO", retry: false };
}

/** Clave de idempotencia del proveedor: el mismo prospecto nunca recibe dos veces la campaña. */
export function sendIdempotencyKey(campaignKey: string, groupKey: string): string {
  return `dnx-escolar:${campaignKey}:${groupKey}`.slice(0, 256);
}

/** Traduce el último evento que informa Resend al estado del prospecto (sólo los que cambian algo). */
export function stateFromProviderEvent(lastEvent: string | null | undefined): ProspectState | null {
  switch (lastEvent) {
    case "bounced":
      return "REBOTADO";
    case "complained":
      return "NO_CONTACTAR";
    default:
      return null;
  }
}
