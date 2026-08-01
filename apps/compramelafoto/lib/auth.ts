/**
 * Auth CLF — fuente de verdad única: cookie opaca `dnx_session` (@repo/auth + UserSession).
 *
 * ETAPA 03 / P0-06:
 * - NO se escribe ni se lee `auth-token` (Legacy) en el runtime normal.
 * - Logout sí expira `auth-token` residual para cutover limpio.
 * - LEGACY_SESSION_AFTER_CUTOVER = RELOGIN_REQUIRED
 *
 * API canónica CLF:
 * - getAuthUser() / getCurrentUser() / getCurrentIdentity()
 * - requireAuth() / requireRole()
 * - setAuthCookie* / clearAuthCookie
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createUserSession,
  destroyUserSessionByRawToken,
  DNX_SESSION_COOKIE,
  getSessionIdentityByRawToken,
  getSessionUserByRawToken,
} from "@repo/auth";
import { prisma, Role } from "./prisma";

/** Cookie Legacy — solo se limpia en logout / al emitir sesión nueva. No es SoT. */
const LEGACY_AUTH_COOKIE_NAME = "auth-token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const COMPRAMELAFOTO_WORKSPACE_COOKIE = "compramelafoto_workspace_id";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;
const APP_URL =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  "";

const isSecureContext =
  process.env.VERCEL === "1" ||
  process.env.NODE_ENV === "production" ||
  APP_URL.startsWith("https://");

const DNX_COOKIE_BASE = {
  httpOnly: true,
  secure: isSecureContext,
  sameSite: "lax" as const,
  path: "/",
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

function logAuthResolution(detail: string): void {
  console.info(`[AUTH] ${detail}`);
}

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  globalRole: string;
  currentWorkspaceId: string | null;
  workspaceRole: string | null;
  appAccess: Array<{ app: string; enabled: boolean; appRole: string | null }>;
  labId?: number;
  emailVerifiedAt?: Date | null;
  allowUnpaidOrderClientData?: boolean;
}

type UserRowForAuth = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  isBlocked: boolean;
  emailVerifiedAt: Date | null;
  allowUnpaidOrderClientData?: boolean;
};

function expireLegacyAuthCookieOnStore(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): void {
  cookieStore.set(LEGACY_AUTH_COOKIE_NAME, "", {
    ...DNX_COOKIE_BASE,
    maxAge: 0,
    expires: new Date(0),
  });
}

function expireLegacyAuthCookieOnResponse(response: NextResponse): void {
  response.cookies.set(LEGACY_AUTH_COOKIE_NAME, "", {
    ...DNX_COOKIE_BASE,
    maxAge: 0,
    expires: new Date(0),
  });
  const parts = [
    `${LEGACY_AUTH_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    "SameSite=Lax",
  ];
  if (isSecureContext) parts.push("Secure");
  if (COOKIE_DOMAIN) parts.push(`Domain=${COOKIE_DOMAIN}`);
  response.headers.append("Set-Cookie", parts.join("; "));
}

function buildDnxSessionSetCookieHeader(rawToken: string, maxAge: number): string {
  const parts = [
    `${DNX_SESSION_COOKIE}=${encodeURIComponent(rawToken)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
  ];
  if (isSecureContext) parts.push("Secure");
  if (COOKIE_DOMAIN) parts.push(`Domain=${COOKIE_DOMAIN}`);
  return parts.join("; ");
}

async function mapPrismaUserToAuthUser(
  user: UserRowForAuth,
  identity?: {
    globalRole: string;
    currentWorkspaceId: string | null;
    workspaceRole: string | null;
    appAccess: Array<{ app: string; enabled: boolean; appRole: string | null }>;
  },
): Promise<AuthUser | null> {
  if (user.isBlocked) return null;

  let labId: number | undefined;
  let effectiveRole = user.role;

  if (user.role === Role.LAB) {
    const lab = await prisma.lab.findUnique({
      where: { userId: user.id },
      select: { id: true, soyFotografo: true },
    });
    if (lab) {
      labId = lab.id;
      if (lab.soyFotografo) effectiveRole = Role.LAB_PHOTOGRAPHER;
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: effectiveRole,
    globalRole: identity?.globalRole ?? (String(user.role) === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER"),
    currentWorkspaceId: identity?.currentWorkspaceId ?? null,
    workspaceRole: identity?.workspaceRole ?? null,
    appAccess: identity?.appAccess ?? [],
    labId,
    emailVerifiedAt: user.emailVerifiedAt,
    allowUnpaidOrderClientData: user.allowUnpaidOrderClientData,
  };
}

/** Input para emitir sesión. `role`/`labId` se aceptan por compat de callers; la sesión DNX solo requiere `id`. */
export type AuthCookieInput = Pick<AuthUser, "id"> &
  Partial<Pick<AuthUser, "email" | "name" | "labId">> & {
    role?: Role | string;
  };

/**
 * Emite sesión DNX canónica. Expira cookie Legacy residual.
 * Falla si no puede crear UserSession (sin fallback auth-token).
 */
export async function setAuthCookie(user: AuthCookieInput): Promise<string> {
  const cookieStore = await cookies();
  const session = await createUserSession(user.id);
  cookieStore.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...DNX_COOKIE_BASE,
    maxAge: session.maxAge,
  });
  expireLegacyAuthCookieOnStore(cookieStore);
  return session.rawToken;
}

/**
 * Emite sesión DNX en una NextResponse (login / OAuth).
 * Expira cookie Legacy residual. Sin fallback auth-token.
 */
export async function setAuthCookieOnResponse(
  response: NextResponse,
  user: AuthCookieInput,
): Promise<void> {
  const session = await createUserSession(user.id);
  response.cookies.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...DNX_COOKIE_BASE,
    maxAge: session.maxAge,
  });
  response.headers.append(
    "Set-Cookie",
    buildDnxSessionSetCookieHeader(session.rawToken, session.maxAge),
  );
  expireLegacyAuthCookieOnResponse(response);
}

/**
 * Resuelve el usuario autenticado SOLO desde `dnx_session`.
 * Cookies `auth-token` Legacy se ignoran (RELOGIN_REQUIRED post-cutover).
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const dnxRaw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
    if (!dnxRaw) {
      logAuthResolution("no_dnx_session");
      return null;
    }

    const sessionUser = await getSessionUserByRawToken(dnxRaw);
    if (!sessionUser) {
      logAuthResolution("dnx_session_invalid");
      return null;
    }

    logAuthResolution(`dnx_session userId=${sessionUser.id}`);
    const requestedWorkspaceId =
      cookieStore.get(COMPRAMELAFOTO_WORKSPACE_COOKIE)?.value ?? null;
    const identity = await getSessionIdentityByRawToken(dnxRaw, {
      currentWorkspaceId: requestedWorkspaceId,
    });
    return mapPrismaUserToAuthUser(
      {
        id: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.name,
        role: sessionUser.role as Role,
        isBlocked: sessionUser.isBlocked ?? false,
        emailVerifiedAt: sessionUser.emailVerifiedAt ?? null,
      },
      identity
        ? {
            globalRole: identity.globalRole,
            currentWorkspaceId: identity.currentWorkspaceId,
            workspaceRole: identity.workspaceRole,
            appAccess: identity.appAccess,
          }
        : undefined,
    );
  } catch {
    return null;
  }
}

/** Identidad canónica CLF (alias). */
export async function getCurrentUser(): Promise<AuthUser | null> {
  return getAuthUser();
}

/** Alias de getAuthUser para contratos de documentación. */
export async function getCurrentIdentity(): Promise<AuthUser | null> {
  return getAuthUser();
}

/** Alias de getAuthUser — sesión = usuario autenticado vía dnx_session. */
export async function getCurrentSession(): Promise<AuthUser | null> {
  return getAuthUser();
}

/**
 * @deprecated Usar setAuthCookieOnResponse. Conservado por compat OAuth:
 * ya no emite auth-token; retorna header Set-Cookie de expiración Legacy.
 */
export function getAuthCookieHeaderValue(user: Pick<AuthUser, "id" | "role">): string {
  void user;
  const parts = [
    `${LEGACY_AUTH_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    "SameSite=Lax",
  ];
  if (isSecureContext) parts.push("Secure");
  if (COOKIE_DOMAIN) parts.push(`Domain=${COOKIE_DOMAIN}`);
  return parts.join("; ");
}

/** Destruye UserSession DNX y expira cookies dnx_session + auth-token residual. */
export async function clearAuthCookie() {
  try {
    const cookieStore = await cookies();
    const dnxRaw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
    if (dnxRaw) {
      await destroyUserSessionByRawToken(dnxRaw);
    }
    cookieStore.set(DNX_SESSION_COOKIE, "", {
      ...DNX_COOKIE_BASE,
      maxAge: 0,
      expires: new Date(0),
    });
    expireLegacyAuthCookieOnStore(cookieStore);
  } catch (err) {
    console.warn("Error clearing auth cookies:", err);
  }
}

export function requireRole(allowedRoles: Role[]) {
  return async (user: AuthUser | null): Promise<boolean> => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };
}

export async function requireAuth(allowedRoles?: Role[]) {
  const user = await getAuthUser();
  if (!user) return { error: "No autenticado", user: null };

  if (allowedRoles) {
    const effectiveRoles = [...allowedRoles];
    // LAB_PHOTOGRAPHER tiene permisos de LAB y PHOTOGRAPHER (paridad Legacy).
    if (allowedRoles.includes(Role.LAB_PHOTOGRAPHER)) {
      effectiveRoles.push(Role.LAB, Role.PHOTOGRAPHER);
    }
    if (allowedRoles.includes(Role.LAB) || allowedRoles.includes(Role.PHOTOGRAPHER)) {
      effectiveRoles.push(Role.LAB_PHOTOGRAPHER);
    }
    if (!effectiveRoles.includes(user.role)) {
      return { error: "No autorizado", user: null };
    }
  }

  return { error: null, user };
}

export function hasAppAccess(
  user: AuthUser | null,
  app: "FOTOFFICE" | "COMPRAMELAFOTO" | "FOTORANK",
): boolean {
  if (!user) return false;
  if (user.globalRole === "SUPER_ADMIN") return true;
  if (user.appAccess.length > 0) {
    return user.appAccess.some((a) => a.app === app && a.enabled);
  }
  if (process.env.DNX_LEGACY_APP_ACCESS_FALLBACK !== "1") return false;
  if (app === "COMPRAMELAFOTO") return true;
  return user.appAccess.some((a) => a.app === app && a.enabled);
}

/** Constantes exportadas para selfchecks / docs. */
export const CLF_AUTH_SOT = {
  cookie: DNX_SESSION_COOKIE,
  legacyCookie: LEGACY_AUTH_COOKIE_NAME,
  legacySessionAfterCutover: "RELOGIN_REQUIRED" as const,
  dualSessionEnabled: false,
  sessionMaxAgeSeconds: COOKIE_MAX_AGE,
};
