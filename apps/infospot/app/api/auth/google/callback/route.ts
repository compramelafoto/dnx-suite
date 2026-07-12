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
  const baseUrl = resolveAppBaseUrl({
    originFromRequest: origin,
    envKeys: ["NEXT_PUBLIC_INFOSPOT_URL", "APP_URL"],
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
      return redirectIngresar(baseUrl, "Cancelaste o falló el acceso con Google.");
    }
    if (!code) {
      return redirectIngresar(baseUrl, "Google no devolvió un código de autorización.");
    }

    const credentials = getGoogleOAuthCredentials();
    if (!credentials) {
      return redirectIngresar(baseUrl, "Google OAuth no está configurado en el servidor.");
    }

    const redirectUri = resolveGoogleRedirectUri(baseUrl);
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
        onCreate: pendingInvite
          ? async ({ email, name, googleId }) => {
              const created = await prisma.user.create({
                data: {
                  email,
                  name,
                  googleId,
                  role: "CUSTOMER",
                  emailVerifiedAt: new Date(),
                },
                select: { id: true, role: true },
              });
              return { id: created.id, role: String(created.role) };
            }
          : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "NO_USER_AND_NO_CREATE") {
        console.info(
          "[infospot] Google login sin User ni invitación",
          hashEmailForLog(google.email),
        );
        return redirectIngresar(
          baseUrl,
          "No hay cuenta DNX con ese Google ni una invitación pendiente. Pedile al Director que te invite.",
        );
      }
      return redirectIngresar(baseUrl, msg);
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

    const target = new URL(destination.path, baseUrl);
    if (!destination.hasAccess) {
      target.searchParams.set(
        "notice",
        "Tu cuenta DNX existe, pero todavía no tenés acceso a Info Spot. Pedile una invitación al Director.",
      );
    }

    const res = NextResponse.redirect(target.toString());
    res.cookies.set(DNX_GOOGLE_OAUTH_COOKIE, "", {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 0,
      expires: new Date(0),
    });
    await attachInfoSpotSessionCookieToResponse(res, resolved.userId, {
      rememberMe: transit.rememberMe === true,
    });
    return res;
  } catch (err) {
    console.error("[infospot] Google OAuth callback error", err);
    return redirectIngresar(
      baseUrl,
      err instanceof Error ? err.message : "Error en el callback de Google.",
    );
  }
}
