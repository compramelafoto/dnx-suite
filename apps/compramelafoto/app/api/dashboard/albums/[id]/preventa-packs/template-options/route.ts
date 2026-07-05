import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { legacyTemplateListWhereForRole } from "@/lib/dashboard/legacy-template-list-where";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/preventa-packs/template-options
 * Plantillas que el backend acepta para BenefitDefinition.templateId en este álbum
 * (biblioteca del álbum, sistema, o ligadas a AlbumProduct del álbum).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
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

    const [library, system, productLinked] = await Promise.all([
      prisma.template.findMany({
        where: { albumId, albumProductId: null, ...(visibility ?? {}) },
        select: { id: true, name: true },
      }),
      prisma.template.findMany({
        where: { isSystemTemplate: true, albumId: null, ...(visibility ?? {}) },
        select: { id: true, name: true, theme: true },
      }),
      prisma.template.findMany({
        where: { albumProduct: { albumId }, ...(visibility ?? {}) },
        select: { id: true, name: true },
      }),
    ]);

    const byId = new Map<
      number,
      { id: number; name: string; group: string }
    >();

    for (const t of library) {
      byId.set(t.id, { id: t.id, name: t.name, group: "Biblioteca del álbum" });
    }
    for (const t of system) {
      if (!byId.has(t.id)) {
        const label = t.theme ? `${t.name} (${t.theme})` : t.name;
        byId.set(t.id, { id: t.id, name: label, group: "Plantillas sistema" });
      }
    }
    for (const t of productLinked) {
      if (!byId.has(t.id)) {
        byId.set(t.id, { id: t.id, name: t.name, group: "Producto pre-venta (catálogo viejo)" });
      }
    }

    const templates = Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es")
    );

    return NextResponse.json({ templates });
  } catch (e) {
    console.error("preventa-packs template-options GET:", e);
    return NextResponse.json({ error: "Error al listar plantillas" }, { status: 500 });
  }
}
