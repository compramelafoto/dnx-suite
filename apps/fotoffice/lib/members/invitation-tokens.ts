import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Tokens de invitación — **solo servidor**.
 *
 * Vive separado de `invitations.ts` a propósito: aquel tiene helpers de presentación que
 * importan componentes cliente, y tenerlos en el mismo archivo metía este `node:crypto`
 * en el bundle del navegador. Turbopack lo descartaba por su cuenta, pero webpack no, y
 * de todos modos generar tokens no es código que deba ser alcanzable desde el cliente.
 *
 * Mismo patrón que `PasswordResetToken`, ya probado en el monorepo: el token crudo se
 * muestra UNA sola vez y en la base solo queda su SHA-256.
 */

/** 32 bytes de entropía criptográfica. `base64url` es seguro dentro de una URL sin escapar. */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Comparación en tiempo constante. La búsqueda normal es por índice único sobre el hash, pero
 * cuando hay que comparar dos hashes directamente se evita filtrar información por el tiempo
 * de respuesta.
 */
export function invitationTokenMatches(rawToken: string, storedHash: string): boolean {
  const computed = Buffer.from(hashInvitationToken(rawToken), "hex");
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}
