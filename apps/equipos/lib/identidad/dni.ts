import { createHmac } from "node:crypto";

/** Deja sólo los dígitos; el DNI válido tiene 7 u 8. Si no, null. */
export function normalizeDni(raw: string): string | null {
  const digits = raw.replace(/[.\s-]/g, "");
  return /^\d{7,8}$/.test(digits) ? digits : null;
}

/** HMAC-SHA256 en hexadecimal. La pimienta llega por parámetro (función pura). */
export function hashDni(dni: string, pepper: string): string {
  return createHmac("sha256", pepper).update(dni).digest("hex");
}
