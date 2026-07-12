import { NextResponse } from "next/server";
import {
  DNX_GOOGLE_OAUTH_COOKIE,
  buildGoogleAuthorizationUrl,
  createGoogleOAuthTransit,
  getGoogleOAuthCredentials,
  resolveAppBaseUrl,
  resolveGoogleRedirectUri,
} from "@repo/auth";
import {
  INFOSPOT_GOOGLE_OAUTH_APP,
  safeInfoSpotNextPath,
} from "@/lib/google-login";
import { SESSION_COOKIE_OPTIONS } from "@/lib/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const origin = url.origin;
    const baseUrl = resolveAppBaseUrl({
      originFromRequest: origin,
      envKeys: ["NEXT_PUBLIC_INFOSPOT_URL", "APP_URL", "AUTH_URL"],
      fallback: "http://localhost:3004",
    });

    const credentials = getGoogleOAuthCredentials();
    if (!credentials) {
      const login = new URL("/ingresar", baseUrl);
      login.searchParams.set(
        "error",
        "Google OAuth no está configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
      );
      return NextResponse.redirect(login.toString());
    }

    const next = safeInfoSpotNextPath(url.searchParams.get("next"));
    const rememberMe = url.searchParams.get("rememberMe") === "1";

    const transit = createGoogleOAuthTransit({
      app: INFOSPOT_GOOGLE_OAUTH_APP,
      next,
      rememberMe,
    });

    const redirectUri = resolveGoogleRedirectUri(baseUrl);
    const authUrl = buildGoogleAuthorizationUrl({
      clientId: credentials.clientId,
      redirectUri,
      state: transit.state,
    });

    const res = NextResponse.redirect(authUrl);
    res.cookies.set(DNX_GOOGLE_OAUTH_COOKIE, transit.cookieValue, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: transit.maxAge,
      httpOnly: true,
      sameSite: "lax",
    });
    return res;
  } catch (err) {
    console.error("[infospot] Google OAuth start error", err);
    return NextResponse.json(
      { error: "No se pudo iniciar el login con Google." },
      { status: 500 },
    );
  }
}
