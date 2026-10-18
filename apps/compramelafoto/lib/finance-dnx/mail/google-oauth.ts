import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { isAllowedAccount } from "./vendors";

export const GMAIL_SCOPES = "openid email https://www.googleapis.com/auth/gmail.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STATE_TTL_MS = 10 * 60_000;
const TIMEOUT_MS = 10_000;

export class OAuthError extends Error {
  constructor(message: string, readonly revoked = false) {
    super(message);
    this.name = "OAuthError";
  }
}

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** `<emitidoMs>.<nonce>.<firma>`: evita que alguien cuelgue su cuenta de Google en la nuestra. */
export function signState(nowMs: number, secret: string): string {
  const payload = `${nowMs}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${hmac(payload, secret)}`;
}

export function verifyState(state: string, nowMs: number, secret: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [issued, nonce, sig] = parts;
  const expected = hmac(`${issued}.${nonce}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const age = nowMs - Number(issued);
  return Number.isFinite(age) && age >= 0 && age <= STATE_TTL_MS;
}

export function buildConsentUrl(p: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", p.clientId);
  url.searchParams.set("redirect_uri", p.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("state", p.state);
  return url.toString();
}

async function postToken(body: Record<string, string>, fetchImpl: typeof fetch) {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, json };
}

function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: unknown };
    return typeof data.email === "string" ? data.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * El id_token se lee sin verificar la firma: llega directo de Google por TLS en el canje
 * del código (servidor a servidor), nunca desde el navegador.
 */
export async function exchangeCode(p: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<{ refreshToken: string; email: string }> {
  const { ok, json } = await postToken(
    {
      code: p.code,
      client_id: p.clientId,
      client_secret: p.clientSecret,
      redirect_uri: p.redirectUri,
      grant_type: "authorization_code",
    },
    p.fetchImpl ?? fetch,
  );
  if (!ok) throw new OAuthError(`Google rechazó la conexión (${String(json.error ?? "error desconocido")}).`);
  const email = emailFromIdToken(json.id_token);
  if (!email) throw new OAuthError("Google no informó qué cuenta se conectó.");
  if (!isAllowedAccount(email)) {
    throw new OAuthError(`La cuenta ${email} no es una de las cuentas de facturación de DNX.`);
  }
  const refreshToken = typeof json.refresh_token === "string" ? json.refresh_token : "";
  if (!refreshToken) {
    throw new OAuthError(
      "Google no dio el permiso permanente. Quitá el acceso de la app en tu cuenta de Google y volvé a conectar.",
    );
  }
  return { refreshToken, email };
}

export async function refreshAccessToken(p: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const { ok, json } = await postToken(
    {
      refresh_token: p.refreshToken,
      client_id: p.clientId,
      client_secret: p.clientSecret,
      grant_type: "refresh_token",
    },
    p.fetchImpl ?? fetch,
  );
  if (!ok) {
    const code = String(json.error ?? "error desconocido");
    throw new OAuthError(
      code === "invalid_grant"
        ? "Google revocó el permiso de lectura. Hay que volver a conectar la cuenta."
        : `Google no renovó el acceso (${code}).`,
      code === "invalid_grant",
    );
  }
  const token = typeof json.access_token === "string" ? json.access_token : "";
  if (!token) throw new OAuthError("Google no devolvió un acceso válido.");
  return token;
}
