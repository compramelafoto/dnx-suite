import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { responderSesionNueva } from "@/lib/control-remoto/rutas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/control-remoto — abre un control remoto para la pantalla de un sorteo en vivo. Lo pide
 * la misma pantalla con su enlace secreto (`code` + `token`): quien ya maneja la pantalla, y nadie más.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { ambito?: unknown; code?: unknown; token?: unknown } | null;
  if (body?.ambito !== "sorteo") return NextResponse.json({ error: "Pantalla desconocida." }, { status: 400 });

  const sorteo = await prisma.liveRaffle.findUnique({
    where: { publicCode: String(body.code ?? "") },
    select: { id: true, screenToken: true },
  });
  if (!sorteo || !body.token || sorteo.screenToken !== String(body.token)) {
    return NextResponse.json({ error: "El enlace de la pantalla ya no es válido. Pedí uno nuevo." }, { status: 403 });
  }
  return responderSesionNueva(req, "sorteo", sorteo.id);
}
