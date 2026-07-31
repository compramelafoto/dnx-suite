import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  DNX_GOOGLE_OAUTH_COOKIE,
  exchangeGoogleAuthCode,
  fetchGoogleUserInfo,
  getGoogleOAuthCredentials,
  hashEmailForLog,
  parseAndVerifyGoogleOAuthTransit,
  resolveOrLinkGoogleUser,
  resolveOrCreateUser,
} from "@repo/auth";
import { prisma } from "@repo/db";
import {
  CLICKATON_GOOGLE_OAUTH_APP,
  resolveClickatonPostGoogleLoginPath,
} from "@/lib/auth/google-oauth";
import {
  attachClickatonSessionCookieToResponse,
  cookieOptionsForRequest,
} from "@/lib/auth/session-cookie";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectLogin(requestUrl: string, message: string) {
  const origin = new URL(requestUrl).origin;
  const url = new URL(CLICKATON_LOGIN_PATH, origin);
  url.searchParams.set("error", message);
  const res = NextResponse.redirect(url.toString());
  res.cookies.set(DNX_GOOGLE_OAUTH_COOKIE, "", {
    ...cookieOptionsForRequest(requestUrl, { oauthTransit: true }),
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");
    const state = url.searchParams.get("state");
    const cookieStore = await cookies();
    const oauthCookie = cookieStore.get(DNX_GOOGLE_OAUTH_COOKIE)?.value ?? null;

    const transit = parseAndVerifyGoogleOAuthTransit({
      state,
      cookieValue: oauthCookie,
      expectedApp: CLICKATON_GOOGLE_OAUTH_APP,
    });

    if (!transit) {
      console.info("[clickaton] Google OAuth transit invalid", {
        hasState: Boolean(state),
        hasCookie: Boolean(oauthCookie),
      });
      return redirectLogin(
        req.url,
        "Sesión de Google inválida o expirada. Intentá de nuevo.",
      );
    }

    if (oauthError) {
      if (oauthError === "access_denied") {
        return redirectLogin(req.url, "Cancelaste el acceso con Google.");
      }
      return redirectLogin(
        req.url,
        "No pudimos iniciar sesión con Google. Volvé a intentarlo.",
      );
    }
    if (!code) {
      return redirectLogin(req.url, "Google no devolvió un código de autorización.");
    }

    const credentials = getGoogleOAuthCredentials();
    if (!credentials) {
      return redirectLogin(req.url, "Google OAuth no está configurado en el servidor.");
    }

    const { accessToken } = await exchangeGoogleAuthCode({
      code,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      redirectUri,
    });
    const google = await fetchGoogleUserInfo(accessToken);

    let resolved;
    try {
      resolved = await resolveOrLinkGoogleUser({
        google,
        onCreate: async ({ email, name, googleId }) => {
          const { user } = await resolveOrCreateUser({
            email,
            name,
            googleId,
            createRole: "CUSTOMER",
            sourceApplication: "clickaton",
            markEmailVerified: true,
          });
          return { id: user.id, role: user.role };
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.info(
        "[clickaton] Google login resolve failed",
        hashEmailForLog(google.email),
        msg,
      );
      return redirectLogin(
        req.url,
        msg.includes("vinculad") || msg.includes("bloqueada")
          ? msg
          : "No pudimos iniciar sesión con Google. Volvé a intentarlo.",
      );
    }

    await prisma.user.update({
      where: { id: resolved.userId },
      data: { lastLoginAt: new Date() },
    });

    const globalRole =
      resolved.suiteRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER";
    const destination = resolveClickatonPostGoogleLoginPath({
      email: resolved.email,
      globalRole,
      next: transit.next,
    });

    const target = new URL(destination.path, origin);
    const res = NextResponse.redirect(target);
    res.cookies.set(DNX_GOOGLE_OAUTH_COOKIE, "", {
      ...cookieOptionsForRequest(req.url, { oauthTransit: true }),
      maxAge: 0,
      expires: new Date(0),
    });

    try {
      await attachClickatonSessionCookieToResponse(res, resolved.userId, {
        requestUrl: req.url,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[clickaton] Google session create failed:", message);
      return redirectLogin(
        req.url,
        "No se pudo guardar la sesión. Volvé a intentarlo.",
      );
    }
    return res;
  } catch (err) {
    console.error("[clickaton] Google OAuth callback error", err);
    return redirectLogin(
      req.url,
      "No pudimos iniciar sesión con Google. Volvé a intentarlo.",
    );
  }
}
