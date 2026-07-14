import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  DNX_GOOGLE_OAUTH_COOKIE,
  exchangeGoogleAuthCode,
  fetchGoogleUserInfo,
  getGoogleOAuthCredentials,
  hashEmailForLog,
  parseAndVerifyGoogleOAuthTransit,
  resolveAppBaseUrl,
  resolveGoogleRedirectUri,
  resolveOrLinkGoogleUser,
} from "@repo/auth";
import { prisma } from "@repo/db";
import {
  INFOSPOT_GOOGLE_OAUTH_APP,
  EDITORIAL_ACCESS_DENIED_NOTICE,
  activateInfoSpotInvitationForUser,
  attachInfoSpotSessionCookieToResponse,
  findInfoSpotPendingInvitation,
  loadPostLoginDestination,
} from "@/lib/google-login";
import { SESSION_COOKIE_OPTIONS } from "@/lib/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectIngresar(baseUrl: string, message: string) {
  const url = new URL("/ingresar", baseUrl);
  url.searchParams.set("error", message);
  const res = NextResponse.redirect(url.toString());
  res.cookies.set(DNX_GOOGLE_OAUTH_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  // Redirects de UX en el mismo host del callback (evita perder cookie cross-host).
  const baseUrl = origin;
  // Token exchange debe usar el redirect_uri registrado (env / APP_URL).
  const oauthBaseUrl = resolveAppBaseUrl({
    originFromRequest: origin,
    envKeys: ["NEXT_PUBLIC_INFOSPOT_URL", "APP_URL", "AUTH_URL"],
    fallback: "http://localhost:3004",
  });

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
      expectedApp: INFOSPOT_GOOGLE_OAUTH_APP,
    });

    if (!transit) {
      return redirectIngresar(baseUrl, "Sesión de Google inválida o expirada. Intentá de nuevo.");
    }

    if (oauthError) {
      return redirectIngresar(
        baseUrl,
        "No pudimos iniciar sesión con Google. Volvé a intentarlo.",
      );
    }
    if (!code) {
      return redirectIngresar(baseUrl, "Google no devolvió un código de autorización.");
    }

    const credentials = getGoogleOAuthCredentials();
    if (!credentials) {
      return redirectIngresar(baseUrl, "Google OAuth no está configurado en el servidor.");
    }

    const redirectUri = resolveGoogleRedirectUri(oauthBaseUrl);
    const { accessToken } = await exchangeGoogleAuthCode({
      code,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      redirectUri,
    });
    const google = await fetchGoogleUserInfo(accessToken);

    const pendingInvite = await findInfoSpotPendingInvitation(google.email);

    let resolved;
    try {
      resolved = await resolveOrLinkGoogleUser({
        google,
        // Usuario nuevo: crear identidad DNX sin rol editorial (salvo invitación pendiente).
        onCreate: async ({ email, name, googleId, picture }) => {
          const created = await prisma.user.create({
            data: {
              email,
              name,
              googleId,
              role: "CUSTOMER",
              emailVerifiedAt: new Date(),
              ...(picture ? { logoUrl: picture } : {}),
            },
            select: { id: true, role: true },
          });
          return { id: created.id, role: String(created.role) };
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.info("[infospot] Google login resolve failed", hashEmailForLog(google.email), msg);
      return redirectIngresar(
        baseUrl,
        "No pudimos iniciar sesión con Google. Volvé a intentarlo.",
      );
    }

    if (pendingInvite) {
      await activateInfoSpotInvitationForUser({
        userId: resolved.userId,
        invitation: pendingInvite,
      });
    }

    const destination = await loadPostLoginDestination(
      resolved.userId,
      resolved.suiteRole,
      transit.next,
    );

    await prisma.user.update({
      where: { id: resolved.userId },
      data: { lastLoginAt: new Date() },
    });

    const target = new URL(destination.path, origin);
    if (destination.reason === "editorial_denied") {
      target.searchParams.set("notice", EDITORIAL_ACCESS_DENIED_NOTICE);
    }

    const res = NextResponse.redirect(target);
    res.cookies.set(DNX_GOOGLE_OAUTH_COOKIE, "", {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 0,
      expires: new Date(0),
    });
    try {
      await attachInfoSpotSessionCookieToResponse(res, resolved.userId, {
        rememberMe: transit.rememberMe === true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[infospot] Google session create failed:", message);
      return redirectIngresar(
        baseUrl,
        `No se pudo guardar la sesión (${message.slice(0, 160)}).`,
      );
    }
    return res;
  } catch (err) {
    console.error("[infospot] Google OAuth callback error", err);
    return redirectIngresar(
      baseUrl,
      err instanceof Error ? err.message : "Error en el callback de Google.",
    );
  }
}
