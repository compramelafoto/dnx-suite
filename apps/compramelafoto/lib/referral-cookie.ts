/**
 * Helpers para la cookie de referido (clf_ref).
 * Cookie no-httpOnly para poder leerla desde el front en /registro.
 */

const REFERRAL_COOKIE_NAME = "clf_ref";
const REFERRAL_COOKIE_MAX_AGE_DAYS = 30;

export function getReferralCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + encodeURIComponent(REFERRAL_COOKIE_NAME) + "=([^;]*)")
  );
  const value = match ? decodeURIComponent(match[1]) : null;
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
