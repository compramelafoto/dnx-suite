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

const COOKIE_NAME = "auth-token";
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

const LEGACY_AUTH_COOKIE_OPTIONS = {
  ...DNX_COOKIE_BASE,
  maxAge: COOKIE_MAX_AGE,
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

function generateLegacyToken(userId: number, role: Role): string {
  const payload = { userId, role, timestamp: Date.now() };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function verifyLegacyToken(token: string): { userId: number; role: Role } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (typeof payload.userId !== "number" || !payload.role) return null;
    return { userId: payload.userId, role: payload.role as Role };
  } catch {
    return null;
  }
}

function buildLegacyAuthCookieHeader(userId: number, role: Role): string {
  const token = generateLegacyToken(userId, role);
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${COOKIE_MAX_AGE}`,
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

function setLegacyAuthCookieOnResponse(
  response: NextResponse,
  userId: number,
  role: Role,
): void {
  const token = generateLegacyToken(userId, role);
  response.cookies.set(COOKIE_NAME, token, LEGACY_AUTH_COOKIE_OPTIONS);
  response.headers.append("Set-Cookie", buildLegacyAuthCookieHeader(userId, role));
}

export type AuthCookieInput = Pick<AuthUser, "id"> &
  Partial<Pick<AuthUser, "email" | "name" | "role" | "labId">>;

export async function setAuthCookie(user: AuthCookieInput) {
  const cookieStore = await cookies();

  try {
    const session = await createUserSession(user.id);
    cookieStore.set(DNX_SESSION_COOKIE, session.rawToken, {
      ...DNX_COOKIE_BASE,
      maxAge: session.maxAge,
    });
    if (user.role) {
      cookieStore.set(COOKIE_NAME, generateLegacyToken(user.id, user.role), LEGACY_AUTH_COOKIE_OPTIONS);
    }
    return session.rawToken;
  } catch (e) {
    console.warn("DNX session create failed (setAuthCookie)", e);
    if (user.role) {
      cookieStore.set(COOKIE_NAME, generateLegacyToken(user.id, user.role), LEGACY_AUTH_COOKIE_OPTIONS);
    }
    return null;
  }
}

export async function setAuthCookieOnResponse(
  response: NextResponse,
  user: AuthCookieInput,
): Promise<void> {
  try {
    const session = await createUserSession(user.id);
    response.cookies.set(DNX_SESSION_COOKIE, session.rawToken, {
      ...DNX_COOKIE_BASE,
      maxAge: session.maxAge,
    });
    response.headers.append(
      "Set-Cookie",
      buildDnxSessionSetCookieHeader(session.rawToken, session.maxAge),
    );
  } catch (e) {
    console.warn("DNX session create failed (setAuthCookieOnResponse)", e);
  }

  if (user.role) {
    setLegacyAuthCookieOnResponse(response, user.id, user.role);
  }
}

/** Header Set-Cookie legacy `auth-token` (redirects OAuth). */
export function getAuthCookieHeaderValue(user: Pick<AuthUser, "id" | "role">): string {
  return buildLegacyAuthCookieHeader(user.id, user.role);
}

async function loadUserForAuth(userId: number): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      emailVerifiedAt: true,
      allowUnpaidOrderClientData: true,
    },
  });
  if (!user) return null;
  return mapPrismaUserToAuthUser(user);
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();

    const dnxRaw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
    if (dnxRaw) {
      const sessionUser = await getSessionUserByRawToken(dnxRaw);
      if (sessionUser) {
        logAuthResolution(`dnx_session userId=${sessionUser.id}`);
        const requestedWorkspaceId =
          cookieStore.get(COMPRAMELAFOTO_WORKSPACE_COOKIE)?.value ?? null;
        const identity = await getSessionIdentityByRawToken(dnxRaw, {
          currentWorkspaceId: requestedWorkspaceId,
        });
        const mapped = await mapPrismaUserToAuthUser(
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
        if (mapped) return mapped;
      }
    }

    const legacyToken = cookieStore.get(COOKIE_NAME)?.value;
    if (legacyToken) {
      const payload = verifyLegacyToken(legacyToken);
      if (payload) {
        logAuthResolution(`auth-token fallback userId=${payload.userId}`);
        const mapped = await loadUserForAuth(payload.userId);
        if (mapped) return mapped;
      }
    }

    return null;
  } catch {
    return null;
  }
}

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
    cookieStore.set(COOKIE_NAME, "", {
      ...DNX_COOKIE_BASE,
      maxAge: 0,
      expires: new Date(0),
    });
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
