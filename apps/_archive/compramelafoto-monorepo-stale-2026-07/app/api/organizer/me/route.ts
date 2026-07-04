import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/organizer/me
 * Devuelve el organizador autenticado (para sesión en el panel).
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ORGANIZER." },
        { status: 401 }
      );
    }

    const organizer = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true },
    });

    if (!organizer) {
      return NextResponse.json({ error: "Organizador no encontrado" }, { status: 404 });
    }

    return NextResponse.json(organizer);
  } catch (err: any) {
    console.error("GET /api/organizer/me ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo organizador", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
