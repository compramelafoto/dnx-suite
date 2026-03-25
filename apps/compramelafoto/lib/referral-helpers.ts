/**
 * Helpers para el sistema de referidos: enmascarado y generación de código.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/**
 * Genera un código de referido corto y único (8 caracteres, sin caracteres ambiguos).
 */
export function generateReferralCode(): string {
  let code = "";
  const bytes = new Uint8Array(CODE_LENGTH);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < CODE_LENGTH; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Enmascara email: ju******@g***.com (2 letras iniciales + dominio parcial).
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "—";
  const t = email.trim().toLowerCase();
  const at = t.indexOf("@");
  if (at <= 0) return "***@***.***";
  const local = t.slice(0, at);
  const domain = t.slice(at + 1);
  const localMasked = local.length <= 2 ? local + "******" : local.slice(0, 2) + "******";
  const dot = domain.lastIndexOf(".");
  const tld = dot > 0 ? domain.slice(dot) : "";
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const domainMasked = domainName.length <= 1 ? domainName + "***" : domainName.slice(0, 1) + "***";
  return `${localMasked}@${domainMasked}${tld}`;
}

/**
 * Enmascara nombre: "Mar*** P****" (iniciales + *** por palabra).
 */
export function maskName(fullName: string | null | undefined): string {
  if (!fullName || typeof fullName !== "string") return "—";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return parts
    .map((p) => (p.length <= 1 ? p + "***" : p.slice(0, 1) + "***"))
    .join(" ");
}

/**
 * Indica si una atribución está activa (no bloqueada y dentro del período de 12 meses).
 * Estado on-the-fly: no se actualiza la DB con cron.
 */
export function isReferralActive(attrib: {
  status: string;
  endsAt: Date;
}): boolean {
  if (!attrib || attrib.status !== "ACTIVE") return false;
  return new Date(attrib.endsAt) > new Date();
}
