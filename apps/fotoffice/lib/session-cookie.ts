import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  DNX_SESSION_COOKIE,
  createUserSession,
  destroyUserSessionByRawToken,
} from "@repo/auth";
import { FOTOFFICE_WORKSPACE_COOKIE } from "@/lib/courses-sales/constants";

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

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_SECURE_CONTEXT,
  sameSite: "lax" as const,
  path: "/",
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

export async function attachFotofficeSessionCookieToResponse(
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

export async function setFotofficeWorkspaceCookieOnResponse(
  response: NextResponse,
  workspaceId: string,
): Promise<void> {
  response.cookies.set(FOTOFFICE_WORKSPACE_COOKIE, workspaceId, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearFotofficeSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DNX_SESSION_COOKIE)?.value;
  if (raw) await destroyUserSessionByRawToken(raw);
  cookieStore.set(DNX_SESSION_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
  cookieStore.set(FOTOFFICE_WORKSPACE_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
}
