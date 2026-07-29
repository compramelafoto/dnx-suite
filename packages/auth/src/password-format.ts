/**
 * Detección y migración progresiva de formatos de contraseña DNX.
 *
 * Canónico: scrypt `saltHex:digestHex` (ver `hashPassword`).
 * Legacy aceptado: bcrypt `$2a$` / `$2b$` / `$2y$`.
 */

export type PasswordHashFormat = "scrypt_v1" | "bcrypt_legacy" | "unknown";

const BCRYPT_PREFIX_REGEX = /^\$2[aby]\$/;
const SCRYPT_V1_REGEX = /^[0-9a-f]{32}:[0-9a-f]{128}$/i;

export function detectPasswordHashFormat(encoded: string): PasswordHashFormat {
  if (!encoded || typeof encoded !== "string") return "unknown";
  if (BCRYPT_PREFIX_REGEX.test(encoded)) return "bcrypt_legacy";
  if (SCRYPT_V1_REGEX.test(encoded)) return "scrypt_v1";
  // Formato scrypt histórico con salt/digest de longitud distinta
  const [salt, digest] = encoded.split(":");
  if (salt && digest && /^[0-9a-f]+$/i.test(salt) && /^[0-9a-f]+$/i.test(digest)) {
    return "scrypt_v1";
  }
  return "unknown";
}

export function isCanonicalPasswordHash(encoded: string): boolean {
  return detectPasswordHashFormat(encoded) === "scrypt_v1";
}

export function isLegacyPasswordHash(encoded: string): boolean {
  return detectPasswordHashFormat(encoded) === "bcrypt_legacy";
}
