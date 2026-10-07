import { createHash, randomBytes } from "node:crypto";

/**
 * El token del enlace con el que un sponsor carga sus propios datos — **sólo servidor**.
 *
 * Mismo patrón que el seguimiento de coberturas (`lib/coverages/tracking-token.ts`): el token
 * crudo se muestra una sola vez, al generar el enlace, y en la base (la de DNX Partners, tabla
 * `DnxPartnerOnboardingInvitation`) queda sólo su SHA-256. Si la base se filtra, los enlaces
 * no sirven.
 */

/** Cuántos días sirve el enlace. Alcanza para que el sponsor lo vea, busque el logo y conteste. */
export const SELF_SIGNUP_DAYS = 30;

/** 32 bytes de entropía. `base64url` entra en una URL sin escapar nada. */
export function generateSelfSignupToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSelfSignupToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Descarta de entrada lo que no puede ser un token nuestro, sin ir a la base. */
export function looksLikeSelfSignupToken(rawToken: string): boolean {
  return /^[A-Za-z0-9_-]{40,60}$/.test(rawToken);
}

export function selfSignupExpiry(now = new Date(), days = SELF_SIGNUP_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export type SelfSignupState = {
  status: "PENDING" | "OPENED" | "SUBMITTED" | "EXPIRED" | "REVOKED";
  expiresAt: Date;
  revokedAt: Date | null;
};

/** El enlace sirve para cargar datos si nadie lo usó todavía, no venció y no se reemplazó. */
export function isSelfSignupUsable(row: SelfSignupState, now = new Date()): boolean {
  if (row.revokedAt) return false;
  if (row.status !== "PENDING" && row.status !== "OPENED") return false;
  return row.expiresAt.getTime() > now.getTime();
}

/** El enlace para compartir. Vacío si la aplicación no sabe su propia dirección. */
export function selfSignupUrl(baseUrl: string, rawToken: string): string {
  return baseUrl ? `${baseUrl}/sponsor/${rawToken}` : "";
}
