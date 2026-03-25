import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/templates/system
 * Lista plantillas del sistema (isSystemTemplate = true) para que el fotógrafo las use.
 * Query: theme (opcional) para filtrar por temática.
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const theme = searchParams.get("theme")?.trim() || null;

    const templates = await prisma.template.findMany({
      where: {
        isSystemTemplate: true,
        ...(theme ? { theme } : {}),
      },
      include: { slots: { orderBy: { index: "asc" } } },
      orderBy: [{ theme: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ templates });
  } catch (e) {
    console.error("GET /api/dashboard/templates/system error:", e);
    return NextResponse.json({ error: "Error al listar plantillas del sistema" }, { status: 500 });
  }
}
