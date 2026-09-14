import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * El token del enlace de seguimiento — **solo servidor**.
 *
 * Mismo patrón que `lib/members/invitation-tokens.ts` y que `PasswordResetToken`: el token
 * crudo viaja una sola vez, en el correo, y en la base queda solo su SHA-256. Si la base se
 * filtra, los enlaces no sirven.
 *
 * Vive en su propio archivo y no junto al dominio del módulo porque `node:crypto` no puede
 * terminar en el bundle del navegador.
 */

/** 32 bytes de entropía. `base64url` entra en una URL sin escapar nada. */
export function generateTrackingToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTrackingToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Comparación en tiempo constante, para no filtrar información por el tiempo de respuesta. */
export function trackingTokenMatches(rawToken: string, storedHash: string): boolean {
  const calculado = Buffer.from(hashTrackingToken(rawToken), "hex");
  let guardado: Buffer;
  try {
    guardado = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (calculado.length !== guardado.length) return false;
  return timingSafeEqual(calculado, guardado);
}

/**
 * Cuándo vence el enlace.
 *
 * Por omisión 120 días, configurable por workspace. El plazo es largo a propósito: el enlace
 * acompaña a la solicitud durante todo su recorrido —evaluación, cobertura, entrega— y que
 * venza a mitad del circuito obligaría a reemitirlo a mano.
 */
export function trackingExpiryFrom(days: number, now = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** El enlace sirve si no venció y nadie lo revocó. */
export function isTrackingLinkUsable(
  row: { tokenExpiresAt: Date; tokenRevokedAt: Date | null },
  now = new Date(),
): boolean {
  if (row.tokenRevokedAt) return false;
  return row.tokenExpiresAt.getTime() > now.getTime();
}
