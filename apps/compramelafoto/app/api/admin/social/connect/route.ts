import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { connectWithSystemToken, InstagramConnectionConfigError } from "@/lib/social/connect-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Conecta la cuenta de Instagram de CompraMeLaFoto con el token del usuario del sistema que
 * está en Vercel (`CLF_INSTAGRAM_SYSTEM_TOKEN`). Solo admin. El token nunca viaja en el
 * pedido ni en la respuesta: se lee del entorno del servidor.
 */
export async function POST() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error ?? "No autorizado" }, { status: 401 });
  try {
    const r = await connectWithSystemToken(user.id);
    return NextResponse.json({ ok: true, username: r.username, pageName: r.pageName });
  } catch (e) {
    const message =
      e instanceof InstagramConnectionConfigError
        ? e.message
        : `Meta no aceptó el token: ${e instanceof Error ? e.message : String(e)}`;
    console.error(`[social] conexión con token del sistema falló: ${message}`);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
