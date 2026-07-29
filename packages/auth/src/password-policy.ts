/**
 * Política única de contraseñas DNX — todas las apps deben usarla.
 */

export const DNX_PASSWORD_MIN_LENGTH = 8;
export const DNX_PASSWORD_MAX_LENGTH = 128;

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; error: string; code: "TOO_SHORT" | "TOO_LONG" | "MISMATCH" | "EMPTY" };

export function validatePasswordPolicy(
  password: string,
  options?: { confirm?: string },
): PasswordPolicyResult {
  if (!password) return { ok: false, code: "EMPTY", error: "La contraseña es obligatoria." };
  if (password.length < DNX_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      code: "TOO_SHORT",
      error: `La contraseña debe tener al menos ${DNX_PASSWORD_MIN_LENGTH} caracteres.`,
    };
  }
  if (password.length > DNX_PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      code: "TOO_LONG",
      error: `La contraseña no puede superar ${DNX_PASSWORD_MAX_LENGTH} caracteres.`,
    };
  }
  if (options?.confirm !== undefined && password !== options.confirm) {
    return { ok: false, code: "MISMATCH", error: "Las contraseñas no coinciden." };
  }
  return { ok: true };
}

export function requirePasswordPolicy(
  password: string,
  options?: { confirm?: string },
): void {
  const result = validatePasswordPolicy(password, options);
  if (!result.ok) throw new Error(result.error);
}
