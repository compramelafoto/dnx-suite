/**
 * Helpers para la cookie de referido (clf_ref) y contexto de origen (clf_ref_meta).
 * Cookies no-httpOnly para poder leerlas desde el front en /registro.
 */

const REFERRAL_COOKIE_NAME = "clf_ref";
const REFERRAL_META_COOKIE_NAME = "clf_ref_meta";
const REFERRAL_COOKIE_MAX_AGE_DAYS = 30;

export type ReferralAttributionSourceClient = {
  sourceType: string;
  sourceEntityId: number;
};

export function getReferralCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + encodeURIComponent(REFERRAL_COOKIE_NAME) + "=([^;]*)")
  );
  const value = match?.[1] ? decodeURIComponent(match[1]) : null;
  return value && value.trim() ? value.trim() : null;
}

/**
 * Setea la cookie desde el cliente (opcional; el middleware ya la setea en cada request con ?ref=).
 */
export function setReferralCookie(code: string): void {
  if (typeof document === "undefined") return;
  const maxAge = REFERRAL_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie =
    encodeURIComponent(REFERRAL_COOKIE_NAME) +
    "=" +
    encodeURIComponent(code) +
    "; Path=/; Max-Age=" +
    maxAge +
    "; SameSite=Lax" +
    (typeof window !== "undefined" && window.location?.protocol === "https:" ? "; Secure" : "");
}

/**
 * Borrar la cookie (ej. después de registro exitoso).
 */
export function deleteReferralCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie =
    encodeURIComponent(REFERRAL_COOKIE_NAME) +
    "=; Path=/; Max-Age=0; SameSite=Lax";
}

function readCookieRaw(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + encodeURIComponent(name) + "=([^;]*)")
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Lee el JSON de clf_ref_meta (origen TRAINING + id de charla). */
export function getReferralMetaCookie(): ReferralAttributionSourceClient | null {
  const raw = readCookieRaw(REFERRAL_META_COOKIE_NAME);
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as {
      sourceType?: string;
      sourceEntityId?: number;
      t?: string;
      i?: number;
    };
    const sourceType = parsed.sourceType ?? parsed.t;
    const sourceEntityId = parsed.sourceEntityId ?? parsed.i;
    if (
      sourceType === "TRAINING" &&
      typeof sourceEntityId === "number" &&
      Number.isFinite(sourceEntityId) &&
      sourceEntityId > 0
    ) {
      return { sourceType: "TRAINING", sourceEntityId };
    }
    return null;
  } catch {
    return null;
  }
}

export function deleteReferralMetaCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie =
    encodeURIComponent(REFERRAL_META_COOKIE_NAME) +
    "=; Path=/; Max-Age=0; SameSite=Lax";
}

/**
 * Origen capacitación: query (?source=training&trainingId=) gana sobre cookie.
 */
export function getTrainingReferralForRegistration(
  sourceFromQuery: string | null,
  trainingIdFromQuery: string | null,
  metaFromCookie: ReferralAttributionSourceClient | null
): ReferralAttributionSourceClient | null {
  const s = sourceFromQuery?.trim();
  const tid = trainingIdFromQuery?.trim();
  if (s === "training" && tid && /^\d+$/.test(tid)) {
    const id = parseInt(tid, 10);
    if (id > 0) return { sourceType: "TRAINING", sourceEntityId: id };
  }
  return metaFromCookie;
}

/**
 * Obtener ref final para el registro: query tiene prioridad, sino cookie.
 */
export function getRefForRegistration(
  refFromQuery: string | null,
  refFromCookie: string | null
): string | null {
  const fromQuery = refFromQuery?.trim() || null;
  const fromCookie = refFromCookie?.trim() || null;
  if (fromQuery) return fromQuery;
  return fromCookie;
}

/** Tras registro exitoso: borrar ref y meta de origen. */
export function clearReferralCookies(): void {
  deleteReferralCookie();
  deleteReferralMetaCookie();
}
