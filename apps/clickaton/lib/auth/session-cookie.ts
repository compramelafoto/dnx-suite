import type { NextResponse } from "next/server";
import {
  DNX_SESSION_COOKIE,
  createUserSession,
} from "@repo/auth";

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;

/**
 * Opciones de cookie según el host de la request.
 * Evita Secure=true en HTTP local (NODE_ENV=production + next start)
 * y desalineaciones con APP_URL de producción.
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
  response.cookies.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...cookieOpts,
    maxAge: session.maxAge,
  });
}
