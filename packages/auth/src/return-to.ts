/**
 * returnTo / next path seguro — anti open-redirect.
 * Cada app puede pasar allowlist de prefijos adicionales.
 */

export type SanitizeReturnToOptions = {
  fallback?: string;
  /** Prefijos permitidos adicionales (ej. `/concursos`). */
  allowedPrefixes?: string[];
  /** Paths bloqueados (login, api, etc.). */
  blockedPrefixes?: string[];
};

const DEFAULT_BLOCKED = ["/api", "/login", "/ingresar", "/recuperar", "/registro", "/crear-cuenta"];

/**
 * Solo paths relativos internos. Rechaza protocol-relative, URLs absolutas y control chars.
 */
export function sanitizeReturnTo(
  raw: string | null | undefined,
  options?: SanitizeReturnToOptions,
): string {
  const fallback = options?.fallback ?? "/";
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  if (value.includes("\\")) return fallback;
  if (value.split("").some((ch) => ch.charCodeAt(0) < 32)) return fallback;

  const blocked = [...DEFAULT_BLOCKED, ...(options?.blockedPrefixes ?? [])];
  for (const prefix of blocked) {
    if (value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`)) {
      return fallback;
    }
  }

  if (options?.allowedPrefixes?.length) {
    const ok = options.allowedPrefixes.some(
      (p) => value === p || value.startsWith(`${p}/`) || value.startsWith(`${p}?`),
    );
    if (!ok && value !== "/") return fallback;
  }

  return value.slice(0, 512);
}

export function isSafeReturnTo(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const sanitized = sanitizeReturnTo(raw, { fallback: "__INVALID__" });
  return sanitized !== "__INVALID__";
}
