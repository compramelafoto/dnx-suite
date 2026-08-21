import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Tokens de invitación. Mismo patrón que `PasswordResetToken`, ya probado en el monorepo:
 * el token crudo se muestra UNA sola vez y en la base solo queda su SHA-256.
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

/** 7 días. Suficiente para que alguien lo vea sin apuro, corto para que un enlace filtrado caduque. */
export const INVITATION_TTL_DAYS = 7;

export function invitationExpiryFrom(now = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type InvitationState = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

/**
 * Estado derivado. No se guarda una columna de estado: se calcula de las fechas, así no puede
 * quedar desincronizado con la realidad (una invitación "pendiente" cuya fecha ya venció).
 */
export function invitationState(
  inv: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now = new Date(),
): InvitationState {
  if (inv.acceptedAt) return "ACCEPTED";
  if (inv.revokedAt) return "REVOKED";
  if (inv.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "PENDING";
}

export function isInvitationUsable(
  inv: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now = new Date(),
): boolean {
  return invitationState(inv, now) === "PENDING";
}

export const INVITATION_STATE_LABELS: Record<InvitationState, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  REVOKED: "Revocada",
  EXPIRED: "Vencida",
};

/**
 * Enlace que el administrador copia y comparte por el medio que quiera (WhatsApp, en persona).
 * FotoOffice no depende hoy de un proveedor de email configurado, así que no se simula un
 * envío que no ocurriría.
 */
export function buildInvitationUrl(baseUrl: string, rawToken: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/invitacion/${encodeURIComponent(rawToken)}`;
}

/** Comparación de emails para autorizar la aceptación: mismo criterio que el resto del módulo. */
export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = a?.trim().toLowerCase();
  const nb = b?.trim().toLowerCase();
  return Boolean(na && nb && na === nb);
}
