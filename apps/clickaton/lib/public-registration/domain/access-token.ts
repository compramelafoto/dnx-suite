import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token de acceso al resumen sin campo publicToken en schema.
 * Firma HMAC(registrationId|exp) — no sustituye login; TTL corta alineada al hold.
 */
export function getPublicRegistrationAccessSecret(): string {
  // AUTH_SECRET declarado en turbo.json; fallback solo para selfcheck/dev local.
  return process.env.AUTH_SECRET || "clickaton-dev-public-registration-secret";
}

export function signRegistrationAccessToken(
  registrationId: string,
  expiresAtMs: number,
  secret = getPublicRegistrationAccessSecret(),
): string {
  const payload = `${registrationId}.${expiresAtMs}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${expiresAtMs}.${sig}`;
}

export function verifyRegistrationAccessToken(
  registrationId: string,
  token: string | null | undefined,
  secret = getPublicRegistrationAccessSecret(),
): boolean {
  if (!token) return false;
  const [expRaw, sig] = token.split(".");
  if (!expRaw || !sig) return false;
  const expiresAtMs = Number(expRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;
  const expected = createHmac("sha256", secret)
    .update(`${registrationId}.${expiresAtMs}`)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
