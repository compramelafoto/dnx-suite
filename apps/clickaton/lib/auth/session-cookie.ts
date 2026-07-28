import type { NextResponse } from "next/server";
import {
  DNX_SESSION_COOKIE,
  createUserSession,
} from "@repo/auth";

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;

type CookieJar = {
  set: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      domain?: string;
      maxAge?: number;
      expires?: Date;
    },
  ) => unknown;
};

/**
 * Opciones de cookie según el host de la request.
 * Evita Secure=true en HTTP local (NODE_ENV=production + next start)
 * y desalineaciones con APP_URL de producción.
 *
 * Preferimos host-only (sin Domain) en apex: www ya redirige 308 al apex.
 * Si COOKIE_DOMAIN está seteado, también limpiamos la variante host-only al
 * rotar/cerrar sesión para evitar loops por cookies stale duplicadas.
 */
export function cookieOptionsForRequest(
  requestUrl: string,
  options?: { oauthTransit?: boolean },
): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  domain?: string;
} {
  let secure = false;
  try {
    const u = new URL(requestUrl);
    const host = u.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    secure = u.protocol === "https:" && !isLocal;
  } catch {
    secure = false;
  }
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    // OAuth transit: sin Domain (host-only) para que el callback del mismo origen la lea.
    ...(options?.oauthTransit || !COOKIE_DOMAIN || !secure
      ? {}
      : { domain: COOKIE_DOMAIN }),
  };
}

/** Borra `dnx_session` host-only y con Domain (si aplica) para no dejar cookies fantasma. */
export function clearClickatonSessionCookie(
  jar: CookieJar,
  base: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    domain?: string;
  },
): void {
  const expired = {
    httpOnly: base.httpOnly,
    secure: base.secure,
    sameSite: base.sameSite,
    path: base.path,
    maxAge: 0,
    expires: new Date(0),
  } as const;
  // Host-only
  jar.set(DNX_SESSION_COOKIE, "", expired);
  // Domain-scoped (COOKIE_DOMAIN actual)
  if (base.domain) {
    jar.set(DNX_SESSION_COOKIE, "", { ...expired, domain: base.domain });
  }
  // Dominio canónico Clickatón por si quedó una cookie vieja de un deploy anterior
  if (base.secure) {
    jar.set(DNX_SESSION_COOKIE, "", {
      ...expired,
      domain: ".maratonfotografica.com",
    });
  }
}

/** Fallback para Server Actions (sin Request) — preferir cookieOptionsForRequest en routes. */
export function getDefaultSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  domain?: string;
} {
  const appUrl =
    process.env.CLICKATON_PUBLIC_WEB_BASE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (appUrl) return cookieOptionsForRequest(appUrl);
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    ...(COOKIE_DOMAIN && isProd ? { domain: COOKIE_DOMAIN } : {}),
  };
}

/** @deprecated Usar cookieOptionsForRequest / getDefaultSessionCookieOptions */
export const SESSION_COOKIE_OPTIONS = getDefaultSessionCookieOptions();

export async function attachClickatonSessionCookieToResponse(
  response: NextResponse,
  userId: number,
  options?: { rememberMe?: boolean; requestUrl?: string },
): Promise<void> {
  const session = await createUserSession(userId, {
    rememberMe: options?.rememberMe === true,
  });
  const cookieOpts = options?.requestUrl
    ? cookieOptionsForRequest(options.requestUrl)
    : getDefaultSessionCookieOptions();
  // Evita que una cookie Domain vieja opaque a la nueva host-only (o viceversa).
  clearClickatonSessionCookie(response.cookies, cookieOpts);
  response.cookies.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...cookieOpts,
    maxAge: session.maxAge,
  });
}
