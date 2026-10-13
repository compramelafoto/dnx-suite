/**
 * Enlace firmado para que la persona borre su selfie del álbum con fotos ocultas
 * (sólo existe cuando el álbum guarda la selfie, retención > 0).
 *
 * Mismo patrón que `app/api/interested/[id]/delete-biometric` (HMAC-SHA256, base64url),
 * con un prefijo propio para que un token de otro flujo no sirva acá. Sin secreto
 * configurado no se firma nada (nunca un literal por defecto).
 *
 * Las funciones de firma/verificación son puras (reciben secreto y hora) para probarlas.
 */
import crypto from "crypto";

const TOKEN_PURPOSE = "hidden-selfie-delete";

/** Secreto para firmar; null si no hay ninguno configurado. */
export function getHiddenSelfieDeletionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env.BIOMETRIC_DELETION_SECRET || env.CRON_SECRET || "";
  return secret.trim() ? secret : null;
}

function hmac(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function signHiddenSelfieDeletionToken(params: {
  attemptId: string;
  albumId: number;
  expiresAtMs: number;
  secret: string;
}): string {
  const payload = `${TOKEN_PURPOSE}:${params.attemptId}:${params.albumId}:${params.expiresAtMs}`;
  const sig = hmac(params.secret, payload);
  return Buffer.from(`${payload}:${sig}`, "utf-8").toString("base64url");
}

export type HiddenSelfieDeletionTokenData = { attemptId: string; albumId: number; expiresAtMs: number };

/**
 * Verifica el token. Devuelve null si está adulterado, vencido, es de otro flujo o
 * no corresponde al álbum indicado.
 */
export function verifyHiddenSelfieDeletionToken(
  token: string,
  opts: { secret: string; albumId: number; nowMs?: number },
): HiddenSelfieDeletionTokenData | null {
  try {
    if (!token || typeof token !== "string") return null;
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 5) return null;
    const [purpose, attemptId, albumIdStr, expiresAtStr, signature] = parts;
    if (purpose !== TOKEN_PURPOSE || !attemptId) return null;

    const payload = `${purpose}:${attemptId}:${albumIdStr}:${expiresAtStr}`;
    const expected = Buffer.from(hmac(opts.secret, payload), "utf-8");
    const received = Buffer.from(signature, "utf-8");
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;

    const albumId = Number(albumIdStr);
    const expiresAtMs = Number(expiresAtStr);
    if (!Number.isInteger(albumId) || albumId !== opts.albumId) return null;
    if (!Number.isFinite(expiresAtMs) || (opts.nowMs ?? Date.now()) > expiresAtMs) return null;

    return { attemptId, albumId, expiresAtMs };
  } catch {
    return null;
  }
}

/** Ruta relativa de la página de borrado para un token. */
export function buildHiddenSelfieDeletionPath(albumId: number, token: string): string {
  return `/api/albums/${albumId}/hidden/selfie/delete?token=${encodeURIComponent(token)}`;
}
