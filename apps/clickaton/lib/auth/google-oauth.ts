import {
  CLICKATON_ACCOUNT_PATH,
  safeClickatonNextPath,
} from "@/lib/auth/return-path";
import { resolveClickatonPostLoginPath } from "@/lib/auth/post-login";

/** Identificador de app en el transit OAuth compartido (`@repo/auth`). */
export const CLICKATON_GOOGLE_OAUTH_APP = "clickaton";

export { safeClickatonNextPath };

/** Href del inicio OAuth Google (navegable sin JS). */
export function buildGoogleOAuthStartHref(options?: {
  next?: string | null;
}): string {
  const params = new URLSearchParams();
  const next = safeClickatonNextPath(options?.next);
  if (next) params.set("next", next);
  const q = params.toString();
  return q ? `/api/auth/google?${q}` : "/api/auth/google";
}

export function resolveClickatonPostGoogleLoginPath(params: {
  email: string;
  globalRole: string;
  next?: string | null;
}): { path: string; authorized: boolean } {
  const result = resolveClickatonPostLoginPath(params);
  return {
    path: result.path,
    authorized: result.adminAuthorized || !result.path.startsWith("/admin"),
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

export { CLICKATON_ACCOUNT_PATH };
