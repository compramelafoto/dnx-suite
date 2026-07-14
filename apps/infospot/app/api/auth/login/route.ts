import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { verifyPassword } from "@repo/auth";
import {
  EDITORIAL_ACCESS_DENIED_NOTICE,
  attachInfoSpotSessionCookieToResponse,
  loadPostLoginDestination,
  safeInfoSpotNextPath,
} from "@/lib/google-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectIngresar(baseUrl: string, message: string) {
  const url = new URL("/ingresar", baseUrl);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url.toString());
}

/**
 * Login email/contraseña vía Route Handler (Set-Cookie fiable, mismo patrón que OAuth).
 */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const baseUrl = origin;

  try {
    const form = await req.formData();
    const email = form.get("email")?.toString()?.trim().toLowerCase() ?? "";
    const password = form.get("password")?.toString() ?? "";
    const rememberMe = form.get("rememberMe") === "on";
    const next = safeInfoSpotNextPath(form.get("next")?.toString(), "/");

    if (!email) return redirectIngresar(baseUrl, "El email es obligatorio.");
    if (!password) return redirectIngresar(baseUrl, "La contraseña es obligatoria.");

    let user: {
      id: number;
      password: string | null;
      isBlocked: boolean;
      role: string;
    } | null;

    try {
      user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, password: true, isBlocked: true, role: true },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[infospot/login] findUnique failed:", message);
      if (/P1001|P1017|Can't reach|ECONNREFUSED|ENOTFOUND|connection/i.test(message)) {
        return redirectIngresar(baseUrl, "No se pudo conectar a la base de datos. Revisá DATABASE_URL.");
      }
      return redirectIngresar(baseUrl, "No se pudo verificar el usuario. Revisá logs del servidor.");
    }

    if (!user) return redirectIngresar(baseUrl, "Email o contraseña incorrectos.");
    if (user.isBlocked) {
      return redirectIngresar(baseUrl, "Esta cuenta está bloqueada. Contactá al Director.");
    }
    if (!user.password) {
      return redirectIngresar(
        baseUrl,
        "Esta cuenta no tiene contraseña. Usá «Continuar con Google», el enlace de invitación o recuperá el acceso.",
      );
    }
    if (!verifyPassword(password, user.password)) {
      return redirectIngresar(baseUrl, "Email o contraseña incorrectos.");
    }

    const destination = await loadPostLoginDestination(user.id, user.role, next);

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (err) {
      console.error("[infospot/login] lastLoginAt update failed:", err);
    }

    const target = new URL(destination.path, origin);
    if (destination.reason === "editorial_denied") {
      target.searchParams.set("notice", EDITORIAL_ACCESS_DENIED_NOTICE);
    }

    const res = NextResponse.redirect(target);
    try {
      await attachInfoSpotSessionCookieToResponse(res, user.id, { rememberMe });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[infospot/login] session create failed:", message);
      return redirectIngresar(
        baseUrl,
        `No se pudo guardar la sesión (${message.slice(0, 120)}).`,
      );
    }
    return res;
  } catch (err) {
    console.error("[infospot/login] unexpected:", err);
    return redirectIngresar(
      baseUrl,
      err instanceof Error ? err.message : "Error al iniciar sesión.",
    );
  }
}
