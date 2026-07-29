/**
 * Normalización canónica de email para identidad DNX.
 * Toda app debe usar esta función — no reimplementar lowercase/trim local.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NormalizeIdentityEmailResult =
  | { ok: true; email: string }
  | { ok: false; error: "EMPTY" | "INVALID_FORMAT" };

export function normalizeIdentityEmail(raw: string): NormalizeIdentityEmailResult {
  const email = raw.trim().toLowerCase();
  if (!email) return { ok: false, error: "EMPTY" };
  if (!EMAIL_RE.test(email) || email.includes("..")) {
    return { ok: false, error: "INVALID_FORMAT" };
  }
  return { ok: true, email };
}

/** Lanza si el email no es válido. */
export function requireNormalizedIdentityEmail(raw: string): string {
  const result = normalizeIdentityEmail(raw);
  if (!result.ok) {
    throw new Error(
      result.error === "EMPTY"
        ? "El email es obligatorio."
        : "El formato de email no es válido.",
    );
  }
  return result.email;
}
