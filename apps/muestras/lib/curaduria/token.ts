import { createHash, randomBytes } from "node:crypto";

/**
 * Token de la invitación a curar. Viaja sólo en el correo; en la base queda su SHA-256, así una
 * copia de la base no alcanza para entrar como curador.
 */
export function nuevoTokenDeInvitacion(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDeToken(token) };
}

export function hashDeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Forma de un token nuestro: 43 caracteres base64url. Lo demás ni se busca en la base. */
export function esTokenConForma(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
