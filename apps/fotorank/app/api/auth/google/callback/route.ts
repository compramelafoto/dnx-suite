import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import {
  resolveOrLinkGoogleUser,
  resolveOrCreateUser,
} from "@repo/auth";
import { attachAdminSessionCookieToResponse } from "../../../../lib/auth";
import {
  FOTORANK_GOOGLE_OAUTH_STATE,
  resolveBaseUrl,
  resolveGoogleRedirectUri,
} from "../../../../lib/google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_PATH = "/login";

function redirectToLogin(baseUrl: string, message: string): NextResponse {
  const url = new URL(LOGIN_PATH, baseUrl);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url.toString());
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const baseUrl = resolveBaseUrl(origin);

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");
    const state = searchParams.get("state");

    if (state !== FOTORANK_GOOGLE_OAUTH_STATE) {
      return redirectToLogin(baseUrl, "Sesión de autenticación inválida. Intentá de nuevo.");
    }

    if (oauthError) {
      return redirectToLogin(baseUrl, "Error al autenticar con Google");
    }

    if (!code) {
      return redirectToLogin(baseUrl, "Código de autorización no recibido");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri = resolveGoogleRedirectUri(baseUrl);

    if (!clientId || !clientSecret) {
      return redirectToLogin(baseUrl, "Configuración de Google OAuth incompleta");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData: unknown = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error("FOTORANK Google token error", tokenData);
      return redirectToLogin(baseUrl, "Error al obtener token de Google");
    }

    const accessToken =
      typeof tokenData === "object" &&
      tokenData !== null &&
      "access_token" in tokenData &&
      typeof (tokenData as { access_token: unknown }).access_token === "string"
        ? (tokenData as { access_token: string }).access_token
        : null;

    if (!accessToken) {
      return redirectToLogin(baseUrl, "Respuesta de token inválida");
    }

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const googleUser: unknown = await userResponse.json();
    if (!userResponse.ok) {
      console.error("FOTORANK Google userinfo error", googleUser);
      return redirectToLogin(baseUrl, "Error al obtener información del usuario");
    }

    if (
      typeof googleUser !== "object" ||
      googleUser === null ||
      !("email" in googleUser) ||
      typeof (googleUser as { email?: unknown }).email !== "string"
    ) {
      return redirectToLogin(baseUrl, "Email no disponible en cuenta de Google");
    }

    const { email, name, id: googleId } = googleUser as {
      email: string;
      name?: string;
      id?: string;
    };

    if (!googleId) {
      return redirectToLogin(baseUrl, "Google no devolvió un identificador de cuenta.");
    }

    let resolved;
    try {
      resolved = await resolveOrLinkGoogleUser({
        google: {
          id: googleId,
          email,
          name: name?.trim() || null,
          verifiedEmail: true,
          picture: null,
        },
        onCreate: async ({ email: e, name: n, googleId: gid }) => {
          // Cuenta DNX base — NO otorga organizador/jurado automáticamente.
          const { user: created } = await resolveOrCreateUser({
            email: e,
            name: n,
            googleId: gid,
            createRole: "CUSTOMER",
            sourceApplication: "fotorank",
            markEmailVerified: true,
          });
          return { id: created.id, role: created.role };
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("FOTORANK Google resolve", msg);
      if (msg.includes("vinculada")) {
        return redirectToLogin(baseUrl, msg);
      }
      if (msg.includes("bloqueada")) {
        return redirectToLogin(baseUrl, "Tu cuenta está bloqueada.");
      }
      return redirectToLogin(
        baseUrl,
        "No se pudo iniciar sesión con Google. Probá de nuevo o contactá soporte.",
      );
    }

    await prisma.user.update({
      where: { id: resolved.userId },
      data: { lastLoginAt: new Date() },
    });

    const isOrganizer =
      resolved.suiteRole === "ORGANIZER" ||
      resolved.suiteRole === "SUPER_ADMIN" ||
      resolved.suiteRole === "ADMIN";
    const dest = new URL(isOrganizer ? "/dashboard" : "/participaciones", baseUrl).toString();
    const response = NextResponse.redirect(dest);
    await attachAdminSessionCookieToResponse(response, resolved.userId);
    return response;
  } catch (err: unknown) {
    console.error("FOTORANK GOOGLE CALLBACK ERROR", err);
    return redirectToLogin(baseUrl, "Error en el callback de Google");
  }
}
