import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth-guards";
import {
  completeInstagramConnection,
  INSTAGRAM_OAUTH_STATE_COOKIE,
  InstagramConnectionConfigError,
} from "@/lib/social/connect-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUCCESS_REDIRECT = "/admin/social?instagram=connected";
const ERROR_REDIRECT = "/admin/social?instagram=error";

/**
 * GET /api/social/instagram/callback — retorno de Meta tras el login de Instagram.
 *
 * Solo para administradores. Nunca loguea la URL completa del request: trae `code`, un
 * dato sensible de un solo uso (canjearlo dos veces ya falla del lado de Meta, así que
 * si queda en un log queda inutilizable pero igual no corresponde escribirlo).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(INSTAGRAM_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(INSTAGRAM_OAUTH_STATE_COOKIE);

  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const metaError = request.nextUrl.searchParams.get("error");

  if (metaError) {
    console.warn(`[social] Instagram devolvió un error en el callback: ${metaError}`);
    return NextResponse.redirect(new URL(ERROR_REDIRECT, request.url));
  }

  // Sin `state` guardado, o si no coincide con el de la cookie, se rechaza: es lo único
  // que evita que se induzca a conectar una cuenta ajena (o dos veces la misma sesión).
  if (!state || !expectedState || state !== expectedState) {
    console.warn("[social] state de Instagram no coincide con la cookie; se rechaza el callback");
    return NextResponse.redirect(new URL(ERROR_REDIRECT, request.url));
  }

  if (!code) {
    console.warn('[social] callback de Instagram sin "code"');
    return NextResponse.redirect(new URL(ERROR_REDIRECT, request.url));
  }

  try {
    // `code` solo se usa acá, en memoria, y no se vuelve a tocar fuera de esta llamada.
    await completeInstagramConnection(code, user.id);
  } catch (error) {
    if (error instanceof InstagramConnectionConfigError) {
      console.error(`[social] ${error.message}`);
    } else {
      console.error(
        "[social] fallo al completar la conexión de Instagram",
        error instanceof Error ? error.message : String(error),
      );
    }
    return NextResponse.redirect(new URL(ERROR_REDIRECT, request.url));
  }

  return NextResponse.redirect(new URL(SUCCESS_REDIRECT, request.url));
}
