import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

export function newPublicId(): string {
  const bytes = randomBytes(12);
  return "ped_" + Array.from(bytes, (b) => BASE32[b % 32]).join("");
}

/**
 * Token de acceso al pedido: HMAC-SHA256(clave, publicId) en base64url. Es determinista a
 * propósito: los mails posteriores reconstruyen el mismo enlace sin invalidar la cookie del
 * comprador. Módulo PURO: la clave se inyecta.
 */
export function orderAccessToken(publicId: string, key: string): string {
  return createHmac("sha256", key).update(publicId).digest("base64url");
}

/** La clave para firmar tokens: la primera variable de entorno no vacía, o null si no hay. */
export function resolveOrderTokenKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  for (const name of ["STORE_ORDER_TOKEN_SECRET", "FOTOFFICE_CRON_SECRET", "CRON_SECRET"]) {
    const value = env[name];
    if (value) return value;
  }
  return null;
}

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function accessTokenMatches(token: string, hash: string): boolean {
  if (!token) return false;
  const a = Buffer.from(hashAccessToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
