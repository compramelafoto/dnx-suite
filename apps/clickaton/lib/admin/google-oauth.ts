import { adminRoutes } from "@/config/admin/navigation";
import { hasClickatonAdminAccess, sanitizeAdminReturnPath } from "@/lib/admin/access";

/** Identificador de app en el transit OAuth compartido (`@repo/auth`). */
export const CLICKATON_GOOGLE_OAUTH_APP = "clickaton";

/**
 * Path post-login seguro para Clickatón admin.
 * Solo rutas internas bajo `/admin` (vía `sanitizeAdminReturnPath`).
 */
export function safeClickatonAdminNextPath(
  raw: string | null | undefined,
): string | undefined {
  if (!raw) return undefined;
  const sanitized = sanitizeAdminReturnPath(raw);
  // Si el raw era inválido, sanitize cae a dashboard — no persistir basura en transit.
  if (!raw.trim().startsWith("/admin")) return undefined;
  if (raw.trim().startsWith("//") || raw.includes("://")) return undefined;
  return sanitized;
}

/** Href del inicio OAuth Google (navegable sin JS). */
export function buildGoogleOAuthStartHref(options?: {
  next?: string | null;
}): string {
  const params = new URLSearchParams();
  const next = safeClickatonAdminNextPath(options?.next);
  if (next) params.set("next", next);
  const q = params.toString();
  return q ? `/api/auth/google?${q}` : "/api/auth/google";
}

/**
 * Destino post-callback: autorización Clickatón es independiente de autenticar en DNX.
 * Usuario autenticado sin permiso → `/admin/acceso-denegado`.
 */
export function resolveClickatonPostGoogleLoginPath(params: {
  email: string;
  globalRole: string;
  next?: string | null;
}): { path: string; authorized: boolean } {
  const authorized = hasClickatonAdminAccess({
    email: params.email,
    globalRole: params.globalRole,
  });
  if (!authorized) {
    return { path: adminRoutes.forbidden, authorized: false };
  }
  return {
    path: sanitizeAdminReturnPath(params.next),
    authorized: true,
  };
}

const KNOWN_GOOGLE_LOGIN_ERRORS = new Set([
  "Cancelaste el acceso con Google.",
  "No pudimos iniciar sesión con Google. Volvé a intentarlo.",
  "Sesión de Google inválida o expirada. Intentá de nuevo.",
  "Google no devolvió un código de autorización.",
  "Google OAuth no está configurado en el servidor.",
  "Google OAuth no está configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
  "Tu cuenta no tiene permiso para administrar Clickatón.",
]);

/** Mensaje seguro para `?error=` en `/admin/login` (sin stacks ni secretos). */
export function friendlyGoogleLoginError(raw: string | null | undefined): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  if (KNOWN_GOOGLE_LOGIN_ERRORS.has(value)) return value;
  if (
    value.length <= 160 &&
    !/[={}]/.test(value) &&
    !/secret|token|client_id|authorization.?code/i.test(value)
  ) {
    return value;
  }
  return "No pudimos iniciar sesión con Google. Volvé a intentarlo.";
}

export { attachClickatonSessionCookieToResponse } from "@/lib/admin/session-cookie";
