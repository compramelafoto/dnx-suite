import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth-guards";
import {
  INSTAGRAM_OAUTH_STATE_COOKIE,
  InstagramConnectionConfigError,
  startInstagramConnection,
} from "@/lib/social/connect-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/social/instagram/connect — inicia la conexión de la cuenta de Instagram de
 * CompraMeLaFoto. Solo para administradores: esto es lo que le da permiso a la app de
 * publicar en la cuenta de Instagram de la empresa.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let connection: ReturnType<typeof startInstagramConnection>;
  try {
    connection = startInstagramConnection(user.id);
  } catch (error) {
    if (error instanceof InstagramConnectionConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }

  const cookieStore = await cookies();
  cookieStore.set(INSTAGRAM_OAUTH_STATE_COOKIE, connection.state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // 10 minutos alcanza de sobra para completar el login de Instagram.
    maxAge: 600,
  });

  return NextResponse.redirect(connection.url);
}
