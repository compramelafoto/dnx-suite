import { NextResponse } from "next/server";
import {
  DNX_GOOGLE_OAUTH_COOKIE,
  buildGoogleAuthorizationUrl,
  createGoogleOAuthTransit,
  getGoogleOAuthCredentials,
  resolveAppBaseUrl,
  resolveGoogleRedirectUri,
} from "@repo/auth";
import { APP_OAUTH } from "@/lib/google-app";
import { rutaInternaSegura } from "@/lib/ruta-segura";
import { OPCIONES_COOKIE } from "@/lib/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Arranca el ingreso con Google. Mismo cliente OAuth que el resto de DNX Suite. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = resolveAppBaseUrl({
      originFromRequest: url.origin,
      envKeys: ["APP_URL", "NEXT_PUBLIC_APP_URL", "AUTH_URL"],
      fallback: "http://localhost:3012",
    });

    const credenciales = getGoogleOAuthCredentials();
    if (!credenciales) {
      const login = new URL("/login", baseUrl);
      login.searchParams.set("error", "El ingreso con Google no está configurado.");
      return NextResponse.redirect(login.toString());
    }

    const transito = createGoogleOAuthTransit({
      app: APP_OAUTH,
      next: rutaInternaSegura(url.searchParams.get("next")),
      rememberMe: url.searchParams.get("recordarme") === "1",
    });

    const respuesta = NextResponse.redirect(
      buildGoogleAuthorizationUrl({
        clientId: credenciales.clientId,
        redirectUri: resolveGoogleRedirectUri(baseUrl),
        state: transito.state,
      }),
    );

    respuesta.cookies.set(DNX_GOOGLE_OAUTH_COOKIE, transito.cookieValue, {
      ...OPCIONES_COOKIE,
      maxAge: transito.maxAge,
      httpOnly: true,
      sameSite: "lax",
    });

    return respuesta;
  } catch (err) {
    console.error("[subilafoto] no se pudo iniciar el login con Google", err);
    return NextResponse.json(
      { error: "No se pudo iniciar el ingreso con Google." },
      { status: 500 },
    );
  }
}
