/**
 * Lectura/limpieza server-side de cookies de referido (clf_ref / clf_ref_meta).
 * Alineado con middleware y lib/referral-cookie.ts (cliente).
 */

export const REFERRAL_COOKIE_NAME = "clf_ref";
export const REFERRAL_META_COOKIE_NAME = "clf_ref_meta";

export type ReferralMetaFromCookie = {
  sourceType: string;
  sourceEntityId: number;
};

function readCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name && decodeURIComponent(key) !== name) continue;
    const raw = part.slice(idx + 1).trim();
    try {
      const value = decodeURIComponent(raw);
      return value && value.trim() ? value.trim() : null;
    } catch {
      return raw && raw.trim() ? raw.trim() : null;
    }
  }
  return null;
}

export function getReferralCodeFromRequest(req: Request): string | null {
  return readCookieFromHeader(req.headers.get("cookie"), REFERRAL_COOKIE_NAME);
}

export function getReferralMetaFromRequest(req: Request): ReferralMetaFromCookie | null {
  const raw = readCookieFromHeader(req.headers.get("cookie"), REFERRAL_META_COOKIE_NAME);
  if (!raw) return null;
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

function buildClearCookieHeader(name: string): string {
  const isProd = process.env.NODE_ENV === "production";
  return (
    encodeURIComponent(name) +
    "=; Path=/; Max-Age=0; SameSite=Lax" +
    (isProd ? "; Secure" : "")
  );
}

/** Adjunta Set-Cookie para borrar clf_ref y clf_ref_meta en la respuesta. */
export function appendClearReferralCookies(headers: Headers): void {
  headers.append("Set-Cookie", buildClearCookieHeader(REFERRAL_COOKIE_NAME));
  headers.append("Set-Cookie", buildClearCookieHeader(REFERRAL_META_COOKIE_NAME));
}
