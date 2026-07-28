import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DNX_SESSION_COOKIE,
  createUserSession,
  destroyUserSessionByRawToken,
  getSessionIdentityByRawToken,
  getSessionUserByRawToken,
} from "@repo/auth";
import { adminRoutes } from "@/config/admin/navigation";
import { normalizeEmail } from "@/config/admin/admins";
import { hasClickatonAdminAccess, sanitizeAdminReturnPath } from "@/lib/admin/access";
import {
  clearClickatonSessionCookie,
  getDefaultSessionCookieOptions,
} from "@/lib/auth/session-cookie";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";

export { hasClickatonAdminAccess, sanitizeAdminReturnPath } from "@/lib/admin/access";

export type ClickatonAuthUser = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  globalRole: string;
  emailVerifiedAt: Date | null;
  logoUrl: string | null;
  /** Email normalizado usado para autorización. */
  trustedEmail: string;
};

/**
 * Obtiene el usuario de la sesión DNX (`dnx_session`).
 * Solo lectura; no modifica cookies.
 */
export async function getClickatonAuthUser(): Promise<ClickatonAuthUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const sessionUser = await getSessionUserByRawToken(raw);
  if (!sessionUser) return null;
  if (sessionUser.isBlocked) return null;

  let globalRole = "USER";
  try {
    const identity = await getSessionIdentityByRawToken(raw);
    globalRole =
      identity?.globalRole ??
      (sessionUser.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER");
  } catch (err) {
    console.error("[clickaton] getSessionIdentityByRawToken failed:", err);
    globalRole = sessionUser.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER";
  }

  const email = typeof sessionUser.email === "string" ? sessionUser.email : "";
  if (!email.trim()) return null;

  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email,
    role: sessionUser.role,
    globalRole,
    emailVerifiedAt: sessionUser.emailVerifiedAt ?? null,
    logoUrl: sessionUser.logoUrl ?? null,
    trustedEmail: normalizeEmail(email),
  };
}

export async function requireClickatonAuth(options?: {
  returnTo?: string;
}): Promise<ClickatonAuthUser> {
  const user = await getClickatonAuthUser();
  if (!user) {
    const next = sanitizeAdminReturnPath(options?.returnTo ?? adminRoutes.dashboard);
    redirect(`${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent(next)}`);
  }
  return user;
}

/**
 * Guard server-side del panel. Redirige a login unificado o acceso denegado.
 */
export async function requireClickatonAdmin(options?: {
  returnTo?: string;
}): Promise<ClickatonAuthUser> {
  const user = await requireClickatonAuth(options);
  if (!hasClickatonAdminAccess(user)) {
    redirect(adminRoutes.forbidden);
  }
  return user;
}

export async function createClickatonSession(userId: number): Promise<void> {
  const session = await createUserSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...getDefaultSessionCookieOptions(),
    maxAge: session.maxAge,
  });
}

export async function destroyClickatonSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
  if (raw) {
    await destroyUserSessionByRawToken(raw);
  }
  clearClickatonSessionCookie(cookieStore, getDefaultSessionCookieOptions());
}
