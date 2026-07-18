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
  FOTOFFICE_GOOGLE_OAUTH_APP,
  attachFotofficeSessionCookieToResponse,
} from "@/lib/google-login";
import { resolveFotofficePostLoginDestination } from "@/lib/post-login";
import {
  SESSION_COOKIE_OPTIONS,
  setFotofficeWorkspaceCookieOnResponse,
} from "@/lib/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectLogin(baseUrl: string, message: string) {
  const url = new URL("/login", baseUrl);
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
  const baseUrl = origin;
  const oauthBaseUrl = resolveAppBaseUrl({
    originFromRequest: origin,
    envKeys: ["APP_URL", "NEXT_PUBLIC_APP_URL", "AUTH_URL"],
    fallback: "http://localhost:3010",
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
      expectedApp: FOTOFFICE_GOOGLE_OAUTH_APP,
    });

    if (!transit) {
      return redirectLogin(baseUrl, "Sesión de Google inválida o expirada. Intentá de nuevo.");
    }

    if (oauthError) {
      if (oauthError === "access_denied") {
        return redirectLogin(baseUrl, "Cancelaste el acceso con Google.");
      }
      return redirectLogin(baseUrl, "No pudimos iniciar sesión con Google. Volvé a intentarlo.");
    }
    if (!code) {
      return redirectLogin(baseUrl, "Google no devolvió un código de autorización.");
    }

    const credentials = getGoogleOAuthCredentials();
    if (!credentials) {
      return redirectLogin(baseUrl, "Google OAuth no está configurado en el servidor.");
    }

    const redirectUri = resolveGoogleRedirectUri(oauthBaseUrl);
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
      console.info("[fotoffice] Google login resolve failed", hashEmailForLog(google.email), msg);
      return redirectLogin(
        baseUrl,
        msg.includes("vinculad")
          ? msg
          : "No pudimos iniciar sesión con Google. Volvé a intentarlo.",
      );
    }

    await prisma.user.update({
      where: { id: resolved.userId },
      data: { lastLoginAt: new Date() },
    });

    // Perfil fotógrafo mínimo (idempotente)
    const existingProfile = await prisma.fotofficePhotographerProfile.findUnique({
      where: { userId: resolved.userId },
      select: { id: true, avatarUrl: true, displayName: true },
    });
    if (!existingProfile) {
      await prisma.fotofficePhotographerProfile.create({
        data: {
          userId: resolved.userId,
          displayName: google.name,
          avatarUrl: google.picture,
        },
      });
    } else if (google.picture && !existingProfile.avatarUrl?.trim()) {
      await prisma.fotofficePhotographerProfile.update({
        where: { userId: resolved.userId },
        data: { avatarUrl: google.picture },
      });
    }

    const destination = await resolveFotofficePostLoginDestination({
      userId: resolved.userId,
      next: transit.next,
    });

    const target = new URL(destination.path, origin);
    const res = NextResponse.redirect(target);
    res.cookies.set(DNX_GOOGLE_OAUTH_COOKIE, "", {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 0,
      expires: new Date(0),
    });

    try {
      await attachFotofficeSessionCookieToResponse(res, resolved.userId, {
        rememberMe: transit.rememberMe === true,
      });
      if (destination.workspaceId) {
        await setFotofficeWorkspaceCookieOnResponse(res, destination.workspaceId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[fotoffice] Google session create failed:", message);
      return redirectLogin(
        baseUrl,
        `No se pudo guardar la sesión (${message.slice(0, 160)}).`,
      );
    }
    return res;
  } catch (err) {
    console.error("[fotoffice] Google OAuth callback error", err);
    return redirectLogin(
      baseUrl,
      err instanceof Error ? err.message : "Error en el callback de Google.",
    );
  }
}
