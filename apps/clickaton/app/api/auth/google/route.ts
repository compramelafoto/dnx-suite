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
  CLICKATON_GOOGLE_OAUTH_APP,
  safeClickatonAdminNextPath,
} from "@/lib/admin/google-oauth";
import { SESSION_COOKIE_OPTIONS } from "@/lib/admin/session-cookie";
import { adminRoutes } from "@/config/admin/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const origin = url.origin;
    const baseUrl = resolveAppBaseUrl({
      originFromRequest: origin,
      envKeys: [
        "CLICKATON_PUBLIC_WEB_BASE_URL",
        "APP_URL",
        "NEXT_PUBLIC_APP_URL",
        "AUTH_URL",
      ],
      fallback: "http://localhost:3005",
    });

    const credentials = getGoogleOAuthCredentials();
    if (!credentials) {
      const login = new URL(adminRoutes.login, baseUrl);
      login.searchParams.set(
        "error",
        "Google OAuth no está configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
      );
      return NextResponse.redirect(login.toString());
    }

    const next = safeClickatonAdminNextPath(url.searchParams.get("next"));

    const transit = createGoogleOAuthTransit({
      app: CLICKATON_GOOGLE_OAUTH_APP,
      ...(next ? { next } : {}),
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
    console.error("[clickaton] Google OAuth start error", err);
    return NextResponse.json(
      { error: "No se pudo iniciar el login con Google." },
      { status: 500 },
    );
  }
}
