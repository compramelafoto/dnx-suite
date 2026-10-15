import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificación de la firma de los webhooks de Resend (formato Svix). Módulo puro.
 *
 * Resend firma cada aviso con `svix-id`, `svix-timestamp` y `svix-signature`. La firma es
 * HMAC-SHA256, en base64, de `${id}.${timestamp}.${cuerpo}` con el secreto `whsec_<base64>`. La
 * cabecera puede traer varias firmas (`v1,<firma> v1,<otra>`) cuando se rota el secreto: alcanza con
 * que una coincida. Se rechazan avisos con más de 5 minutos de diferencia (reenvíos maliciosos).
 *
 * Se escribe acá con `node:crypto` y no con el SDK para no sumar una dependencia al monorepo.
 */

export const SVIX_TOLERANCE_SECONDS = 5 * 60;

export type SvixInput = {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  body: string;
  nowSeconds: number;
};

export type SvixResult = { ok: true } | { ok: false; reason: "MISSING" | "STALE" | "INVALID" | "BAD_SECRET" };

function secretBytes(secret: string): Buffer | null {
  const raw = secret.trim().startsWith("whsec_") ? secret.trim().slice(6) : secret.trim();
  if (!raw) return null;
  try {
    const b = Buffer.from(raw, "base64");
    return b.length > 0 ? b : null;
  } catch {
    return null;
  }
}

export function signSvix(secret: string, id: string, timestamp: string, body: string): string {
  const key = secretBytes(secret);
  if (!key) throw new Error("secreto inválido");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

export function verifySvix(input: SvixInput): SvixResult {
  if (!input.id || !input.timestamp || !input.signatureHeader) return { ok: false, reason: "MISSING" };
  const key = secretBytes(input.secret);
  if (!key) return { ok: false, reason: "BAD_SECRET" };
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts) || Math.abs(input.nowSeconds - ts) > SVIX_TOLERANCE_SECONDS) return { ok: false, reason: "STALE" };

  const expected = createHmac("sha256", key).update(`${input.id}.${input.timestamp}.${input.body}`).digest();
  for (const part of input.signatureHeader.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    let given: Buffer;
    try {
      given = Buffer.from(sig, "base64");
    } catch {
      continue;
    }
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: "INVALID" };
}
