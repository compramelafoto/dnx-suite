/** Path relativo seguro (anti open-redirect). */
export function safeInfoSpotNextPath(raw: string | null | undefined, fallback = "/redaccion"): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

/** Href del inicio OAuth Google (navegable sin JS). */
export function buildGoogleOAuthStartHref(options?: {
  next?: string | null;
  rememberMe?: boolean;
}): string {
  const params = new URLSearchParams();
  const nextRaw = typeof options?.next === "string" ? options.next.trim() : "";
  if (nextRaw.startsWith("/") && !nextRaw.startsWith("//")) {
    params.set("next", nextRaw);
  }
  if (options?.rememberMe === true) {
    params.set("rememberMe", "1");
  }
  const q = params.toString();
  return q ? `/api/auth/google?${q}` : "/api/auth/google";
}

/** Mensaje seguro para `?error=` en `/ingresar` (sin stacks ni secretos). */
export function friendlyGoogleLoginError(raw: string | null | undefined): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;

  const known = new Set([
    "Cancelaste o falló el acceso con Google.",
    "No pudimos iniciar sesión con Google. Volvé a intentarlo.",
    "Sesión de Google inválida o expirada. Intentá de nuevo.",
    "Google no devolvió un código de autorización.",
    "Google OAuth no está configurado en el servidor.",
    "Google OAuth no está configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
    "No tenés acceso editorial. Solicitá permisos al Director.",
  ]);
  if (known.has(value)) return value;
  if (value.length <= 160 && !/[={}]/.test(value) && !/secret|token|client_id/i.test(value)) {
    return value;
  }
  return "No pudimos iniciar sesión con Google. Volvé a intentarlo.";
}

/**
 * Destino post-login estructural (sin permisos de DB) para tests del start OAuth.
 * La autoridad real de roles sigue en `resolveInfoSpotPostLoginPath` (google-login.ts).
 */
export function resolveInfoSpotPostLoginPathLite(params: {
  suiteRole: string;
  membershipRole: string | null;
  membershipStatus: string | null;
  next?: string | null;
}): { path: string; hasAccess: boolean } {
  const isSuperAdmin = params.suiteRole === "SUPER_ADMIN";
  const active = params.membershipStatus === "ACTIVE" || isSuperAdmin;
  const hasRole = Boolean(params.membershipRole);
  const hasAccess = isSuperAdmin || (active && hasRole);

  if (!hasAccess) {
    return { path: "/ingresar/acceso-pendiente", hasAccess: false };
  }

  const next = safeInfoSpotNextPath(params.next, "");
  if (next && next !== "/redaccion" && next !== "/ingresar" && next !== "/ingresar/acceso-pendiente") {
    return { path: next, hasAccess: true };
  }

  return { path: "/redaccion", hasAccess: true };
}
