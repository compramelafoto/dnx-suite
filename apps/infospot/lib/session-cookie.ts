import { cookies } from "next/headers";
import {
  DNX_SESSION_COOKIE,
  createUserSession,
  destroyUserSessionByRawToken,
  revokeAllUserSessions,
} from "@repo/auth";

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;
const APP_URL =
  process.env.NEXT_PUBLIC_INFOSPOT_URL?.trim() ||
  process.env.APP_URL?.trim() ||
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

/** Emite `dnx_session` (HttpOnly, Secure en prod, SameSite=Lax, maxAge 7d). */
export async function createInfoSpotSession(userId: number): Promise<void> {
  const session = await createUserSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
}

export async function destroyInfoSpotSession(): Promise<void> {
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
}

export async function revokeAllSessionsForUser(userId: number): Promise<void> {
  await revokeAllUserSessions(userId);
}
