import { randomInt } from "node:crypto";
import { normalizarTelefono } from "@/lib/whatsapp/telefono";

/** El código vence a los 15 minutos. */
export const PHONE_CODE_TTL_MS = 15 * 60_000;

/** `"EQ-"` + 6 dígitos. */
export function generatePhoneCode(): string {
  return `EQ-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
}

/** Enlace `wa.me` que abre WhatsApp con el código ya escrito. */
export function buildWhatsappLink(number: string, code: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(code)}`;
}

/** Busca `EQ-` + 6 dígitos en cualquier parte del texto. */
export function extractCode(text: string): string | null {
  return /EQ-\d{6}/.exec(text)?.[0] ?? null;
}

export function matchPhoneVerification(input: {
  fromPhone: string;
  text: string;
  now: Date;
  pending: { phone: string; code: string; codeExpiresAt: Date; verifiedAt: Date | null };
}): boolean {
  const { fromPhone, text, now, pending } = input;
  if (pending.verifiedAt) return false;
  if (now.getTime() > pending.codeExpiresAt.getTime()) return false;
  if (extractCode(text) !== pending.code) return false;
  const from = normalizarTelefono(fromPhone);
  return from !== "" && from === normalizarTelefono(pending.phone);
}
