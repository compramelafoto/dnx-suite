/**
 * Cambio de email de inicio de sesión (CLF).
 *
 * El pedido se guarda en `EmailVerificationToken` sin tocar el esquema: el campo `email`
 * lleva `cambio-email:<userId>:<emailNuevo>` y el propósito es `VERIFY_EMAIL`. Ese valor no
 * coincide con ningún usuario, así que la verificación de alta (`/api/auth/verify-email`)
 * nunca lo puede usar para marcar a alguien como verificado.
 */

export const CAMBIO_EMAIL_PREFIJO = "cambio-email:";
/** Horas que vale el enlace que llega a la dirección nueva. */
export const CAMBIO_EMAIL_HORAS = 24;

export function codificarCambioEmail(userId: number, emailNuevo: string): string {
  return `${CAMBIO_EMAIL_PREFIJO}${userId}:${emailNuevo}`;
}

export function prefijoCambioEmailDeUsuario(userId: number): string {
  return `${CAMBIO_EMAIL_PREFIJO}${userId}:`;
}

export function decodificarCambioEmail(
  valor: string,
): { userId: number; emailNuevo: string } | null {
  if (!valor.startsWith(CAMBIO_EMAIL_PREFIJO)) return null;
  const resto = valor.slice(CAMBIO_EMAIL_PREFIJO.length);
  const sep = resto.indexOf(":");
  if (sep <= 0) return null;
  const userId = Number(resto.slice(0, sep));
  const emailNuevo = resto.slice(sep + 1);
  if (!Number.isInteger(userId) || userId <= 0 || !emailNuevo.includes("@")) return null;
  return { userId, emailNuevo };
}
