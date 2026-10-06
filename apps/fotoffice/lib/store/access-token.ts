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

/**
 * La clave para firmar tokens, o null si no hay.
 *
 * En producción (`VERCEL_ENV === "production"`) sólo vale `STORE_ORDER_TOKEN_SECRET`: si la
 * firma de los enlaces de pedido colgara del secreto del cron, rotar ese secreto (o filtrarse)
 * rompería —o abriría— todos los enlaces de los compradores. Sin la variable, la tienda no crea
 * pedidos y lo avisa (`create-order.ts`). En local y en previews se acepta el secreto del cron
 * como reemplazo, para no tener que configurar uno más para probar.
 *
 * Un valor de puros espacios cuenta como vacío (un copiar y pegar mal hecho en el panel).
 */
export function resolveOrderTokenKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const nombres =
    env.VERCEL_ENV === "production"
      ? ["STORE_ORDER_TOKEN_SECRET"]
      : ["STORE_ORDER_TOKEN_SECRET", "FOTOFFICE_CRON_SECRET", "CRON_SECRET"];
  for (const name of nombres) {
    const value = env[name]?.trim();
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
