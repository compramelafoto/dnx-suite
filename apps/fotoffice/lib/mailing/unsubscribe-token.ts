import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Enlace de baja firmado. Módulo puro (salvo `crypto`).
 *
 * El token lleva la institución y la casilla, y una firma HMAC: nadie puede dar de baja a otra
 * persona cambiando la dirección, y el enlace no vence (un correo viejo tiene que poder seguir
 * dando de baja). La clave se deriva para este uso, así una filtración de otro token no sirve acá.
 */

export type UnsubscribePayload = { workspaceId: string; email: string };

const PURPOSE = "fotoffice-mailing-unsubscribe-v1";

/** Nombres de variables, en orden. La primera con valor gana. */
export const UNSUBSCRIBE_SECRET_VARS = ["FOTOFFICE_MAILING_SECRET", "FOTOFFICE_CRON_SECRET", "CRON_SECRET"] as const;

export function resolveUnsubscribeSecret(env: Record<string, string | undefined> = process.env): string | null {
  for (const name of UNSUBSCRIBE_SECRET_VARS) {
    const v = env[name]?.trim();
    if (v) return v;
  }
  return null;
}

function key(secret: string): Buffer {
  return createHmac("sha256", secret).update(PURPOSE).digest();
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signUnsubscribeToken(payload: UnsubscribePayload, secret: string): string {
  const body = b64url(JSON.stringify({ w: payload.workspaceId, e: payload.email.trim().toLowerCase() }));
  const sig = b64url(createHmac("sha256", key(secret)).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyUnsubscribeToken(token: string | null | undefined, secret: string): UnsubscribePayload | null {
  if (!token || token.length > 2000) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = createHmac("sha256", key(secret)).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { w?: unknown; e?: unknown };
    if (typeof parsed.w !== "string" || typeof parsed.e !== "string" || !parsed.w || !parsed.e.includes("@")) return null;
    return { workspaceId: parsed.w, email: parsed.e };
  } catch {
    return null;
  }
}
