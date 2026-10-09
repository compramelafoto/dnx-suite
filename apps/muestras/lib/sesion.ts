import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  DNX_SESSION_COOKIE,
  createUserSession,
  destroyUserSessionByRawToken,
} from "@repo/auth";

/**
 * La cookie de sesión, compartida con el resto de DNX Suite.
 *
 * Es la misma cookie que usan las otras apps: la identidad es una sola en toda la suite.
 */

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined;
const APP_URL =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  "";

// En local sobre HTTP la cookie nunca puede ir con Secure, o el navegador la descarta
// y el login "funciona" sin dejar sesión. VERCEL=1 suele quedar puesto en la terminal.
const ES_LOCAL_HTTP =
  APP_URL.startsWith("http://localhost") || APP_URL.startsWith("http://127.0.0.1");

const ES_CONTEXTO_SEGURO =
  !ES_LOCAL_HTTP &&
  (process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production" ||
    APP_URL.startsWith("https://"));

export const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: ES_CONTEXTO_SEGURO,
  sameSite: "lax" as const,
  path: "/",
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

export async function adjuntarSesion(
  respuesta: NextResponse,
  userId: number,
  opciones?: { recordarme?: boolean },
): Promise<void> {
  const sesion = await createUserSession(userId, {
    rememberMe: opciones?.recordarme === true,
  });
  respuesta.cookies.set(DNX_SESSION_COOKIE, sesion.rawToken, {
    ...OPCIONES_COOKIE,
    maxAge: sesion.maxAge,
  });
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  const raw = almacen.get(DNX_SESSION_COOKIE)?.value;
  // Se destruye del lado del servidor, no sólo se borra la cookie: si no, el token
  // seguiría siendo válido para cualquiera que lo hubiera copiado.
  if (raw) await destroyUserSessionByRawToken(raw);
  almacen.set(DNX_SESSION_COOKIE, "", {
    ...OPCIONES_COOKIE,
    maxAge: 0,
    expires: new Date(0),
  });
}
