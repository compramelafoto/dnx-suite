import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import {
  DNX_SESSION_COOKIE,
  createUserSession,
  destroyUserSessionByRawToken,
  getSessionUserByRawToken,
  revokeAllUserSessions,
} from "@repo/auth";
import { parseUserId } from "./userId";

const LEGACY_AUTH_COOKIE = "dnx_auth";

/**
 * Cookie de sesión legacy de ComprameLaFoto (`apps/compramelafoto/lib/auth.ts`, `COOKIE_NAME`).
 * Mismo dominio (staging/producción): hay que borrarla al cerrar sesión en Fotorank o la app sigue autenticada solo con `auth-token`.
 */
const COMPRAMELAFOTO_AUTH_TOKEN_COOKIE = "auth-token";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;
const APP_URL =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  "";
const IS_SECURE_CONTEXT =
  process.env.VERCEL === "1" ||
  process.env.NODE_ENV === "production" ||
  APP_URL.startsWith("https://");

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_SECURE_CONTEXT,
  sameSite: "lax" as const,
  path: "/",
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

export type AuthUser = {
  id: number;
  name: string | null;
  email: string;
};

/**
 * Obtiene el usuario autenticado desde la cookie (solo lectura / BD).
 * No modifica cookies aquí: en App Router solo Route Handlers y Server Actions pueden hacer `cookies().set` / `delete`
 * (p. ej. layout y páginas RSC).
 *
 * - Token opaco: sesión por SHA-256 del token.
 * - Cookie legada (= userId en claro): solo en `NODE_ENV !== "production"`. En producción hay que iniciar sesión de nuevo.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const sessionUser = await getSessionUserByRawToken(raw);
  if (sessionUser) {
    return { id: sessionUser.id, name: sessionUser.name, email: sessionUser.email };
  }

  /**
   * Fallback legado solo para desarrollo:
   * - `dnx_auth` con userId en claro (no token)
   * - permite no bloquear flujos locales viejos durante la migración
   */
  if (process.env.NODE_ENV !== "production") {
    const legacyRaw = cookieStore.get(LEGACY_AUTH_COOKIE)?.value;
    const legacyId = parseUserId(legacyRaw ?? "");
    if (legacyId !== null) {
      const legacyUser = await prisma.user.findUnique({
        where: { id: legacyId },
        select: { id: true, name: true, email: true },
      });
      if (legacyUser) {
        return legacyUser;
      }
    }
  }

  return null;
}

/**
 * Exige sesión. Redirige a /login si no hay usuario.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Crea fila de sesión y fija cookie httpOnly con el token en claro (solo en tránsito).
 */
export async function createAdminSessionForUser(userId: number): Promise<void> {
  const session = await createUserSession(userId);

  const cookieStore = await cookies();
  cookieStore.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
}

/** Para Route Handlers (p. ej. callback OAuth): misma cookie que `createAdminSessionForUser`. */
export async function attachAdminSessionCookieToResponse(
  response: NextResponse,
  userId: number,
): Promise<void> {
  const session = await createUserSession(userId);
  response.cookies.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
}

/**
 * @deprecated Usar `createAdminSessionForUser`. Se mantiene para llamadas existentes (login).
 */
export async function setAuthCookie(userId: number): Promise<void> {
  await createAdminSessionForUser(userId);
}

/** Elimina la sesión actual (fila en BD + cookie). Idempotente. */
export async function destroyCurrentAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
  if (raw) {
    await destroyUserSessionByRawToken(raw);
  }
  cookieStore.set(DNX_SESSION_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
  cookieStore.set(LEGACY_AUTH_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
  cookieStore.set(COMPRAMELAFOTO_AUTH_TOKEN_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Cierra la sesión (alias de `destroyCurrentAdminSession`).
 */
export async function clearAuthCookie(): Promise<void> {
  await destroyCurrentAdminSession();
}

/** Revoca todas las sesiones del usuario (cambio de contraseña, bloqueo, etc.). */
export async function revokeAllAdminSessionsForUser(userId: number): Promise<void> {
  await revokeAllUserSessions(userId);
}
