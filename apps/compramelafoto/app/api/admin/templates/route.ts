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
 * POST /api/admin/templates
 * Crea una plantilla pública del sistema (sin álbum). Solo admin.
 * Body: { name, imageUrl, widthCm, heightCm, slots, textElements?, pagesJson?, theme? }
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const imageUrl = String(body?.imageUrl ?? "").trim();
    const widthCm = Number(body?.widthCm);
    const heightCm = Number(body?.heightCm);
    const slots = Array.isArray(body?.slots) ? body.slots : [];
    const textElements = Array.isArray(body?.textElements) ? body.textElements : null;
    const pagesJson = Array.isArray(body?.pagesJson) ? body.pagesJson : null;
    const theme = typeof body?.theme === "string" ? body.theme.trim() || null : null;

    if (!name) {
      return NextResponse.json({ error: "name es requerido" }, { status: 400 });
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl es requerido" }, { status: 400 });
    }
    if (!Number.isFinite(widthCm) || widthCm <= 0 || !Number.isFinite(heightCm) || heightCm <= 0) {
      return NextResponse.json({ error: "widthCm y heightCm deben ser números positivos" }, { status: 400 });
    }

    const template = await prisma.template.create({
      data: {
        albumId: null,
        albumProductId: null,
        name,
        imageUrl,
        widthCm,
        heightCm,
        isSystemTemplate: true,
        theme,
        textElementsJson: textElements as object | undefined,
        pagesJson: pagesJson as object[] | undefined,
        slots: {
          create: slots.map((s: { index?: number; bbox?: Record<string, number> }, i: number) => ({
            index: Number.isInteger(s.index) ? s.index : i,
            bbox: s.bbox && typeof s.bbox === "object" ? (s.bbox as object) : { x: 0, y: 0, width: 100, height: 100 },
          })),
        },
      },
      include: { slots: true },
    });

    return NextResponse.json({ template });
  } catch (e) {
    console.error("POST /api/admin/templates error:", e);
    return NextResponse.json({ error: "Error al crear plantilla" }, { status: 500 });
  }
}
