/**
 * El enlace del correo con el que el autor responde (spec O5). Módulo PURO.
 *
 * El token son 32 bytes al azar en base64url; en la base sólo se guarda su sha256 en hex, así que
 * quien lea la base no puede armar el enlace. Vence a los 60 días. Reenviar el correo genera uno
 * nuevo y pisa el hash: el enlace anterior deja de abrir.
 */
import { createHash, randomBytes } from "node:crypto";

export const CONSENT_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;
/** Un reenvío por permiso cada 24 h: que el panel no se convierta en una máquina de spam. */
export const CONSENT_RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Forma del token: 32 bytes en base64url son 43 caracteres. Filtra basura antes de ir a la base. */
const TOKEN_FORMA = /^[A-Za-z0-9_-]{43}$/;

export function hashConsentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newConsentToken(now: Date, random: (n: number) => Buffer = randomBytes): {
  token: string;
  tokenHash: string;
  tokenExpiresAt: Date;
} {
  const token = random(32).toString("base64url");
  return { token, tokenHash: hashConsentToken(token), tokenExpiresAt: new Date(now.getTime() + CONSENT_TOKEN_TTL_MS) };
}

export function looksLikeConsentToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_FORMA.test(token);
}

export function isConsentTokenExpired(tokenExpiresAt: Date, now: Date): boolean {
  return tokenExpiresAt.getTime() <= now.getTime();
}

/** ¿Se puede volver a mandar el correo? Nunca enviado (o el envío falló) → sí. */
export function canResendConsent(notifiedAt: Date | null, now: Date): boolean {
  return notifiedAt === null || now.getTime() - notifiedAt.getTime() >= CONSENT_RESEND_COOLDOWN_MS;
}
