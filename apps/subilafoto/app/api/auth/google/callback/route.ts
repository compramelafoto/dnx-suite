import { NextResponse, after } from "next/server";
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
import { reportSuiteReferralSignup, SUITE_REFERRAL_COOKIE } from "@repo/auth/suite-referral";
import { prisma } from "@repo/db";
import { adjuntarSesion, OPCIONES_COOKIE } from "@/lib/sesion";
import { APP_OAUTH } from "@/lib/google-app";
import { codigoDeReferidoParaReportar } from "@/lib/referido-suite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function volverAlLogin(baseUrl: string, mensaje: string) {
  const url = new URL("/login", baseUrl);
  url.searchParams.set("error", mensaje);
  const respuesta = NextResponse.redirect(url.toString());
  respuesta.cookies.set(DNX_GOOGLE_OAUTH_COOKIE, "", {
    ...OPCIONES_COOKIE,
    maxAge: 0,
    expires: new Date(0),
  });
  return respuesta;
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const baseOAuth = resolveAppBaseUrl({
    originFromRequest: origin,
    envKeys: ["APP_URL", "NEXT_PUBLIC_APP_URL", "AUTH_URL"],
    fallback: "http://localhost:3012",
  });

  try {
    const url = new URL(req.url);
    const almacen = await cookies();

    // Se verifica el estado ANTES de mirar el código: así un callback armado por otro
    // sitio no llega ni a intentar el intercambio.
    const transito = parseAndVerifyGoogleOAuthTransit({
      state: url.searchParams.get("state"),
      cookieValue: almacen.get(DNX_GOOGLE_OAUTH_COOKIE)?.value ?? null,
      expectedApp: APP_OAUTH,
    });

    if (!transito) {
      return volverAlLogin(origin, "El ingreso con Google venció. Probá de nuevo.");
    }

    const errorGoogle = url.searchParams.get("error");
    if (errorGoogle) {
      return volverAlLogin(
        origin,
        errorGoogle === "access_denied"
          ? "Cancelaste el ingreso con Google."
          : "No pudimos ingresar con Google. Volvé a intentarlo.",
      );
    }

    const code = url.searchParams.get("code");
    if (!code) return volverAlLogin(origin, "Google no devolvió el código de autorización.");

    const credenciales = getGoogleOAuthCredentials();
    if (!credenciales) {
      return volverAlLogin(origin, "El ingreso con Google no está configurado.");
    }

    const { accessToken } = await exchangeGoogleAuthCode({
      code,
      clientId: credenciales.clientId,
      clientSecret: credenciales.clientSecret,
      redirectUri: resolveGoogleRedirectUri(baseOAuth),
    });

    const google = await fetchGoogleUserInfo(accessToken);

    let resuelto;
    // Sólo se llena si la cuenta se crea en este ingreso (para el aviso de referidos).
    let cuentaNueva: { id: number; email: string; name: string | null } | null = null;
    try {
      resuelto = await resolveOrLinkGoogleUser({
        google,
        onCreate: async ({ email, name, googleId, picture }) => {
          const creado = await prisma.user.create({
            data: {
              email,
              name,
              googleId,
              role: "CUSTOMER",
              emailVerifiedAt: new Date(),
              ...(picture ? { logoUrl: picture } : {}),
            },
            select: { id: true, role: true, email: true, name: true },
          });
          cuentaNueva = { id: creado.id, email: creado.email, name: creado.name };
          return { id: creado.id, role: String(creado.role) };
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // El correo se registra hasheado: sirve para rastrear el caso sin guardar el dato.
      console.info("[subilafoto] login con Google rechazado", hashEmailForLog(google.email), msg);
      return volverAlLogin(
        origin,
        msg.includes("vinculad") ? msg : "No pudimos ingresar con Google. Volvé a intentarlo.",
      );
    }

    await prisma.user.update({
      where: { id: resuelto.userId },
      data: { lastLoginAt: new Date() },
    });

    const destino = transito.next ?? "/panel";
    const respuesta = NextResponse.redirect(new URL(destino, origin));

    respuesta.cookies.set(DNX_GOOGLE_OAUTH_COOKIE, "", {
      ...OPCIONES_COOKIE,
      maxAge: 0,
      expires: new Date(0),
    });

    await adjuntarSesion(respuesta, resuelto.userId, {
      recordarme: transito.rememberMe === true,
    });

    // Referidos de DNX Suite: si la cuenta es nueva y llegó con `?dnx_ref=`, se le avisa a
    // ComprameLaFoto quién la refirió. Va en `after` para no demorar el ingreso, y nunca tira
    // error. La cookie se borra sólo cuando se usó: quien ya tenía cuenta la conserva sin efecto.
    const codigoReferido = codigoDeReferidoParaReportar(
      resuelto.created,
      almacen.get(SUITE_REFERRAL_COOKIE)?.value,
    );
    const nueva = cuentaNueva as { id: number; email: string; name: string | null } | null;
    if (codigoReferido && nueva) {
      after(() =>
        reportSuiteReferralSignup({
          platform: "subilafoto",
          code: codigoReferido,
          externalUserId: nueva.id,
          email: nueva.email,
          name: nueva.name,
        }),
      );
      respuesta.cookies.set(SUITE_REFERRAL_COOKIE, "", { path: "/", maxAge: 0, expires: new Date(0) });
    }

    return respuesta;
  } catch (err) {
    console.error("[subilafoto] error en el callback de Google", err);
    return volverAlLogin(origin, "No pudimos completar el ingreso. Volvé a intentarlo.");
  }
}
