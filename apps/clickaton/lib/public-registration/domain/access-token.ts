import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token de acceso al resumen (10D3F-B v2).
 * Claims firmados: purpose + editionSlug + registrationId + exp.
 * Formato: `v2.{expiresAtMs}.{sig}` — sin PII.
 */
export type RegistrationAccessClaims = {
  purpose: "summary";
  editionSlug: string;
  registrationId: string;
  expiresAtMs: number;
};

export function getPublicRegistrationAccessSecret(): string {
  return process.env.AUTH_SECRET || "clickaton-dev-public-registration-secret";
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function signRegistrationAccessToken(
  input: {
    registrationId: string;
    editionSlug: string;
    expiresAtMs: number;
    purpose?: "summary";
  },
  secret = getPublicRegistrationAccessSecret(),
): string {
  const purpose = input.purpose ?? "summary";
  const payload = `v2|${purpose}|${input.editionSlug}|${input.registrationId}|${input.expiresAtMs}`;
  const sig = signPayload(payload, secret);
  return `v2.${input.expiresAtMs}.${sig}`;
}

export type AccessTokenVerifyResult =
  | { ok: true; claims: RegistrationAccessClaims }
  | { ok: false; code: "TOKEN_INVALID" | "TOKEN_EXPIRED" };

export function verifyRegistrationAccessToken(
  input: {
    registrationId: string;
    editionSlug: string;
    token: string | null | undefined;
    now?: Date;
  },
  secret = getPublicRegistrationAccessSecret(),
): AccessTokenVerifyResult {
  const token = input.token?.trim();
  if (!token) return { ok: false, code: "TOKEN_INVALID" };
  const nowMs = (input.now ?? new Date()).getTime();

  // v2
  if (token.startsWith("v2.")) {
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, code: "TOKEN_INVALID" };
    const [, expRaw, sig] = parts;
    const expiresAtMs = Number(expRaw);
    if (!Number.isFinite(expiresAtMs)) return { ok: false, code: "TOKEN_INVALID" };
    if (expiresAtMs < nowMs) return { ok: false, code: "TOKEN_EXPIRED" };
    const payload = `v2|summary|${input.editionSlug}|${input.registrationId}|${expiresAtMs}`;
    const expected = signPayload(payload, secret);
    if (!sig || !safeEqual(sig, expected)) return { ok: false, code: "TOKEN_INVALID" };
    return {
      ok: true,
      claims: {
        purpose: "summary",
        editionSlug: input.editionSlug,
        registrationId: input.registrationId,
        expiresAtMs,
      },
    };
  }

  // legacy 10D3F: `{exp}.{sig}` sobre `registrationId.exp` (sin slug)
  const [expRaw, sig] = token.split(".");
  if (!expRaw || !sig) return { ok: false, code: "TOKEN_INVALID" };
  const expiresAtMs = Number(expRaw);
  if (!Number.isFinite(expiresAtMs)) return { ok: false, code: "TOKEN_INVALID" };
  if (expiresAtMs < nowMs) return { ok: false, code: "TOKEN_EXPIRED" };
  const expected = signPayload(`${input.registrationId}.${expiresAtMs}`, secret);
  if (!safeEqual(sig, expected)) return { ok: false, code: "TOKEN_INVALID" };
  return {
    ok: true,
    claims: {
      purpose: "summary",
      editionSlug: input.editionSlug,
      registrationId: input.registrationId,
      expiresAtMs,
    },
  };
}

/** Compat: booleano simple usado por código antiguo. */
export function isRegistrationAccessTokenValid(
  registrationId: string,
  token: string | null | undefined,
  editionSlug: string,
): boolean {
  return verifyRegistrationAccessToken({ registrationId, editionSlug, token }).ok;
}
