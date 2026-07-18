import { adminRoutes } from "@/config/admin/navigation";

export const CLICKATON_ACCOUNT_PATH = "/mi-cuenta";
export const CLICKATON_LOGIN_PATH = "/login";

/**
 * Destino post-login seguro para Clickatón (público + admin).
 * Solo paths relativos internos; anti open-redirect.
 */
export function sanitizeClickatonReturnPath(
  raw: string | null | undefined,
  fallback: string = CLICKATON_ACCOUNT_PATH,
): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  if (value.includes("\\")) return fallback;
  if (value.startsWith("/api")) return fallback;
  if (value.startsWith(CLICKATON_LOGIN_PATH)) return fallback;
  if (value.startsWith(adminRoutes.login)) return fallback;
  if (value.split("").some((ch) => ch.charCodeAt(0) < 32)) return fallback;
  return value.slice(0, 512);
}

/** Destino admin (compat): solo `/admin…`. */
export function sanitizeAdminReturnPath(raw: string | null | undefined): string {
  const value = sanitizeClickatonReturnPath(raw, adminRoutes.dashboard);
  if (!value.startsWith("/admin")) return adminRoutes.dashboard;
  return value;
}

/** Persistir en transit OAuth solo si el raw ya es un path interno aceptable. */
export function safeClickatonNextPath(
  raw: string | null | undefined,
): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) {
    return undefined;
  }
  if (trimmed.startsWith("/api") || trimmed.startsWith(CLICKATON_LOGIN_PATH)) {
    return undefined;
  }
  if (trimmed.startsWith(adminRoutes.login)) return undefined;
  return sanitizeClickatonReturnPath(trimmed);
}
