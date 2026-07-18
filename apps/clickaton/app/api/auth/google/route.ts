import { NextResponse } from "next/server";
import {
  DNX_GOOGLE_OAUTH_COOKIE,
  DNX_GOOGLE_OAUTH_COOKIE_MAX_AGE,
  buildGoogleAuthorizationUrl,
  createGoogleOAuthTransit,
  getGoogleOAuthCredentials,
} from "@repo/auth";
import {
  CLICKATON_GOOGLE_OAUTH_APP,
  safeClickatonNextPath,
} from "@/lib/auth/google-oauth";
import { cookieOptionsForRequest } from "@/lib/auth/session-cookie";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    // redirect_uri = origin de la request (no GOOGLE_REDIRECT_URI / APP_URL).
    // Cookie host-only + callback del mismo host → evita "Sesión de Google inválida".
    const origin = url.origin;
    const redirectUri = `${origin}/api/auth/google/callback`;

    const credentials = getGoogleOAuthCredentials();
    if (!credentials) {
      const login = new URL(CLICKATON_LOGIN_PATH, origin);
      login.searchParams.set(
        "error",
        "Google OAuth no está configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
      );
      return NextResponse.redirect(login.toString());
    }

    const next = safeClickatonNextPath(url.searchParams.get("next"));

    const transit = createGoogleOAuthTransit({
      app: CLICKATON_GOOGLE_OAUTH_APP,
      ...(next ? { next } : {}),
    });

    const authUrl = buildGoogleAuthorizationUrl({
      clientId: credentials.clientId,
      redirectUri,
      state: transit.state,
    });

    const res = NextResponse.redirect(authUrl);
    const cookieOpts = cookieOptionsForRequest(req.url, { oauthTransit: true });
    res.cookies.set(DNX_GOOGLE_OAUTH_COOKIE, transit.cookieValue, {
      ...cookieOpts,
      maxAge: transit.maxAge || DNX_GOOGLE_OAUTH_COOKIE_MAX_AGE,
    });
    return res;
  } catch (err) {
    console.error("[clickaton] Google OAuth start error", err);
    return NextResponse.json(
      { error: "No se pudo iniciar el login con Google." },
      { status: 500 },
    );
  }
}
