import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/templates
 * Lista todas las plantillas (solo admin). Filtros: theme, isSystem, albumId.
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const theme = searchParams.get("theme")?.trim() || null;
    const isSystem = searchParams.get("isSystem");
    const albumIdParam = searchParams.get("albumId");
    const albumId = albumIdParam ? parseInt(albumIdParam, 10) : null;

    const where: { isSystemTemplate?: boolean; theme?: string | null; albumId?: number | null } = {};
    if (theme) where.theme = theme;
    if (isSystem === "true") where.isSystemTemplate = true;
    if (isSystem === "false") where.isSystemTemplate = false;
    if (albumIdParam !== null && albumIdParam !== "") {
      if (Number.isInteger(albumId)) where.albumId = albumId;
      else where.albumId = null; // plantillas sin álbum (públicas)
    }

    const templates = await prisma.template.findMany({
      where,
      include: {
        slots: { orderBy: { index: "asc" } },
        album: { select: { id: true, title: true, userId: true } },
      },
      orderBy: [{ isSystemTemplate: "desc" }, { theme: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ templates });
  } catch (e) {
    console.error("GET /api/admin/templates error:", e);
    return NextResponse.json({ error: "Error al listar plantillas" }, { status: 500 });
  }
}

/**
 * POST retirado: el diseñador viejo ya no crea plantillas. Todo el circuito de diseño usa el
 * diseñador nuevo (`TemplateV2`); ver docs/compramelafoto/DISENO-V2-SELECCION-Y-APROBACION.md.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "El diseñador viejo se retiró. Creá la plantilla en el diseñador nuevo (Diseños → Mis plantillas).",
    },
    { status: 410 }
  );
}

