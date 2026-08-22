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

/** 72 horas. Suficiente para verlo sin apuro, corto para que un enlace filtrado caduque. */
export const INVITATION_TTL_HOURS = 72;

export function invitationExpiryFrom(now = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_HOURS * 60 * 60 * 1000);
}

/**
 * Estados del socio habilitados para emitir o aceptar una invitación.
 *
 * Los valores son los tres reales del enum `MemberStatus`: ACTIVE, SUSPENDED e INACTIVE. En
 * esta etapa solo ACTIVE opera — a alguien suspendido o dado de baja no se le da acceso, y
 * tampoco puede completar una invitación emitida antes del cambio de estado.
 */
export function canMemberUseInvitations(status: "ACTIVE" | "SUSPENDED" | "INACTIVE"): boolean {
  return status === "ACTIVE";
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

export type InvitationUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: "CONFIGURATION_ERROR" };

/**
 * Enlace absoluto de la invitación, construido SIEMPRE sobre `APP_URL` del servidor.
 *
 * Sin respaldo relativo y sin usar `NEXT_PUBLIC_APP_URL`: una base ausente producía
 * `/invitacion/<token>`, que dentro de un email no lleva a ninguna parte. Que falte es un
 * error de configuración y se informa como tal, no se disimula con una URL a medias.
 */
export function buildInvitationUrl(
  rawToken: string,
  env: Record<string, string | undefined> = process.env,
): InvitationUrlResult {
  const raw = env.APP_URL?.trim();
  if (!raw) return { ok: false, reason: "CONFIGURATION_ERROR" };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "CONFIGURATION_ERROR" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "CONFIGURATION_ERROR" };
  }

  const base = raw.replace(/\/+$/, "");
  return { ok: true, url: `${base}/invitacion/${encodeURIComponent(rawToken)}` };
}

/** Comparación de emails para autorizar la aceptación: mismo criterio que el resto del módulo. */
export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = a?.trim().toLowerCase();
  const nb = b?.trim().toLowerCase();
  return Boolean(na && nb && na === nb);
}

export type MemberAccessStatus =
  | "NO_ACCESS"
  | "NOT_SENT"
  | "SEND_FAILED"
  | "PENDING"
  | "EXPIRED"
  | "REVOKED"
  | "ACTIVE_ACCESS";

/**
 * Estado de acceso que ve el administrador en la ficha, derivado de la última invitación.
 *
 * "Invitación pendiente" exige `sentAt`: una invitación creada NO es una invitación enviada, y
 * mostrarla como enviada haría que el administrador espere una respuesta que nunca va a llegar.
 * Por eso existen `NOT_SENT` y `SEND_FAILED` como estados propios.
 */
export function memberAccessStatus(
  member: { userId: number | null },
  latest:
    | {
        acceptedAt: Date | null;
        revokedAt: Date | null;
        expiresAt: Date;
        sentAt: Date | null;
        sendFailedAt: Date | null;
      }
    | null
    | undefined,
  now: Date = new Date(),
): MemberAccessStatus {
  if (member.userId !== null) return "ACTIVE_ACCESS";
  if (!latest) return "NO_ACCESS";

  switch (invitationState(latest, now)) {
    case "ACCEPTED":
      return "ACTIVE_ACCESS";
    case "REVOKED":
      return "REVOKED";
    case "EXPIRED":
      return "EXPIRED";
    case "PENDING":
      if (latest.sentAt) return "PENDING";
      return latest.sendFailedAt ? "SEND_FAILED" : "NOT_SENT";
  }
}

export const MEMBER_ACCESS_LABELS: Record<MemberAccessStatus, string> = {
  NO_ACCESS: "Sin acceso",
  NOT_SENT: "Creada, sin enviar",
  SEND_FAILED: "No se pudo enviar",
  PENDING: "Invitación pendiente",
  EXPIRED: "Invitación vencida",
  REVOKED: "Invitación revocada",
  ACTIVE_ACCESS: "Acceso activo",
};
