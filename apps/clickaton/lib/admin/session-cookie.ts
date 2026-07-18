import type { NextResponse } from "next/server";
import {
  DNX_SESSION_COOKIE,
  createUserSession,
} from "@repo/auth";

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;
const APP_URL =
  process.env.CLICKATON_PUBLIC_WEB_BASE_URL?.trim() ||
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  "";

/** Local HTTP must never set Secure (VERCEL=1 en el shell es habitual con CLI). */
const IS_LOCAL_HTTP =
  APP_URL.startsWith("http://localhost") ||
  APP_URL.startsWith("http://127.0.0.1");

const IS_SECURE_CONTEXT =
  !IS_LOCAL_HTTP &&
  (process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production" ||
    APP_URL.startsWith("https://"));

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_SECURE_CONTEXT,
  sameSite: "lax" as const,
  path: "/",
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

export async function attachClickatonSessionCookieToResponse(
  response: NextResponse,
  userId: number,
  options?: { rememberMe?: boolean },
): Promise<void> {
  const session = await createUserSession(userId, {
    rememberMe: options?.rememberMe === true,
  });
  response.cookies.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
}
