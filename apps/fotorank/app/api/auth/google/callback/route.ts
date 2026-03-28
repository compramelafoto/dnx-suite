import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
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

    const emailNorm = email.toLowerCase();

    let user = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (!user) {
      try {
        user = await prisma.user.create({
          data: {
            email: emailNorm,
            name: name?.trim() || null,
            googleId: googleId || null,
            role: "ORGANIZER",
          },
        });
      } catch (e) {
        console.error("FOTORANK Google create user", e);
        return redirectToLogin(baseUrl, "No se pudo crear la cuenta. Probá de nuevo o contactá soporte.");
      }
    } else {
      if (user.isBlocked) {
        return redirectToLogin(baseUrl, "Tu cuenta está bloqueada.");
      }
      if (user.googleId && googleId && user.googleId !== googleId) {
        return redirectToLogin(
          baseUrl,
          "Esta cuenta ya está vinculada a otra identidad de Google.",
        );
      }
      if (!user.googleId && googleId) {
        try {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId },
          });
        } catch (e) {
          console.error("FOTORANK Google link googleId", e);
          return redirectToLogin(
            baseUrl,
            "No se pudo vincular la cuenta de Google (identificador en uso).",
          );
        }
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const dashboardUrl = new URL("/dashboard", baseUrl).toString();
    const response = NextResponse.redirect(dashboardUrl);
    await attachAdminSessionCookieToResponse(response, user.id);
    return response;
  } catch (err: unknown) {
    console.error("FOTORANK GOOGLE CALLBACK ERROR", err);
    return redirectToLogin(baseUrl, "Error en el callback de Google");
  }
}
