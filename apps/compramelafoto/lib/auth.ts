import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import {
  createUserSession,
  destroyUserSessionByRawToken,
  DNX_SESSION_COOKIE,
  getSessionUserByRawToken,
} from "@repo/auth";
import { prisma } from "./prisma";

const COOKIE_NAME = "auth-token";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;
const APP_URL =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  "";

// Secure en entornos HTTPS (staging/prod). Localhost HTTP queda en false.
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
  console.info(`[AUTH][DNX_SESSION] ${detail}`);
}

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  labId?: number;
  emailVerifiedAt?: Date | null;
}

type UserRowForAuth = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  isBlocked: boolean;
  emailVerifiedAt: Date | null;
};

/** Misma forma AuthUser que el flujo legacy (incl. LAB → labId y rol efectivo). */
async function mapPrismaUserToAuthUser(user: UserRowForAuth): Promise<AuthUser | null> {
  if (user.isBlocked) {
    return null;
  }

  let labId: number | undefined;
  let effectiveRole = user.role;

  if (user.role === Role.LAB) {
    const lab = await prisma.lab.findUnique({
      where: { userId: user.id },
      select: { id: true, soyFotografo: true },
    });
    if (lab) {
      labId = lab.id;
      if (lab.soyFotografo) {
        effectiveRole = Role.LAB_PHOTOGRAPHER;
      }
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: effectiveRole,
    labId,
    emailVerifiedAt: user.emailVerifiedAt,
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
  if (isSecureContext) {
    parts.push("Secure");
  }
  if (COOKIE_DOMAIN) {
    parts.push(`Domain=${COOKIE_DOMAIN}`);
  }
  return parts.join("; ");
}

export async function setAuthCookie(user: AuthUser) {
  const cookieStore = await cookies();

  try {
    const session = await createUserSession(user.id);
    cookieStore.set(DNX_SESSION_COOKIE, session.rawToken, {
      ...DNX_COOKIE_BASE,
      maxAge: session.maxAge,
    });
    return session.rawToken;
  } catch (e) {
    console.warn("DNX session create failed (setAuthCookie), no legacy auth-token emitted", e);
    return null;
  }
}

/**
 * Emite solo `dnx_session` para nuevos logins/callbacks.
 */
export async function setAuthCookieOnResponse(response: NextResponse, user: AuthUser): Promise<void> {
  let dnxHeader: string | null = null;
  try {
    const session = await createUserSession(user.id);
    response.cookies.set(DNX_SESSION_COOKIE, session.rawToken, {
      ...DNX_COOKIE_BASE,
      maxAge: session.maxAge,
    });
    dnxHeader = buildDnxSessionSetCookieHeader(session.rawToken, session.maxAge);
  } catch (e) {
    console.warn("DNX session create failed, no legacy auth-token emitted", e);
  }
  if (dnxHeader) {
    response.headers.append("Set-Cookie", dnxHeader);
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();

    // 1) Sesión DNX (UserSession + dnx_session)
    const dnxRaw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
    if (dnxRaw) {
      const sessionUser = await getSessionUserByRawToken(dnxRaw);
      if (sessionUser) {
        logAuthResolution(`Sesión resuelta por dnx_session userId=${sessionUser.id}`);
        const mapped = await mapPrismaUserToAuthUser({
          id: sessionUser.id,
          email: sessionUser.email,
          name: sessionUser.name,
          role: sessionUser.role,
          isBlocked: sessionUser.isBlocked,
          emailVerifiedAt: sessionUser.emailVerifiedAt,
        });
        if (mapped) {
          return mapped;
        }
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

// Verificar roles
export function requireRole(allowedRoles: Role[]) {
  return async (user: AuthUser | null): Promise<boolean> => {
    if (!user) {
      return false;
    }
    return allowedRoles.includes(user.role);
  };
}

// Middleware helper para APIs
export async function requireAuth(allowedRoles?: Role[]) {
  const user = await getAuthUser();

  if (!user) {
    return { error: "No autenticado", user: null };
  }

  if (allowedRoles) {
    // LAB_PHOTOGRAPHER tiene permisos de LAB y PHOTOGRAPHER
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
