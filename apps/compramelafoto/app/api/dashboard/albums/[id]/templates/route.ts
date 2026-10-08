import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { legacyTemplateListWhereForRole } from "@/lib/dashboard/legacy-template-list-where";
import { listAlbumPackTemplateV2CardGroups } from "@/lib/dashboard/album-pack-template-v2-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/templates
 * Lista plantillas de la biblioteca del álbum (sin asignar a producto).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = parseInt((await params).id, 10);
    if (!Number.isInteger(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const visibility = legacyTemplateListWhereForRole(user.role);
    const templates = await prisma.template.findMany({
      where: { albumId, albumProductId: null, ...(visibility ?? {}) },
      include: { slots: { orderBy: { index: "asc" } } },
      orderBy: { id: "asc" },
    });

    const { templatesV2Owned, templatesV2Catalog } = await listAlbumPackTemplateV2CardGroups({
      ownerUserId: user.id,
    });
    const templatesV2 = [...templatesV2Owned, ...templatesV2Catalog].map((c) => ({
      id: c.id,
      name: c.name,
    }));

    return NextResponse.json({ templates, templatesV2, templatesV2Owned, templatesV2Catalog });
  } catch (e) {
    console.error("album templates GET error:", e);
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

