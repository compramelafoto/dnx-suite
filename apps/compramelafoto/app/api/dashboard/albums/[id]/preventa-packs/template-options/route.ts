import { NextRequest, NextResponse } from "next/server";
import { clientPhotoSlotNumber } from "@repo/template-editor-core";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/preventa-packs/template-options
 *
 * Plantillas del diseñador nuevo que se pueden asignar a un beneficio de preventa: las del
 * fotógrafo y las publicadas en el catálogo (al guardar, una del catálogo se copia a su cuenta).
 * Cada una dice cuántas fotos del cliente usa, para que no se elija una que no arma nada.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = parseInt((await params).id, 10);
    if (!Number.isInteger(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const album = await prisma.album.findFirst({ where: { id: albumId, userId: user.id }, select: { id: true } });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const publicRows = await prisma.templateV2Publication.findMany({
      where: { reviewStatus: "APPROVED", visibility: "PUBLIC" },
      select: { templateId: true },
    });
    const publicIds = new Set(publicRows.map((r) => r.templateId));

    const templates = await prisma.templateV2.findMany({
      where: { OR: [{ ownerUserId: user.id }, { id: { in: [...publicIds] } }], status: { not: "ARCHIVED" } },
      select: { id: true, name: true, ownerUserId: true, currentVersionId: true },
      orderBy: { name: "asc" },
    });

    const versionIds = templates.map((t) => t.currentVersionId).filter((id): id is string => Boolean(id));
    const blocks = versionIds.length
      ? await prisma.templateV2Block.findMany({
          where: { templateVersionId: { in: versionIds }, type: { in: ["IMAGE", "PHOTO"] } },
          select: { templateVersionId: true, type: true, configJson: true },
        })
      : [];
    const photoNumbersByVersion = new Map<string, Set<number>>();
    for (const b of blocks) {
      const n = clientPhotoSlotNumber(b);
      if (n == null) continue;
      const set = photoNumbersByVersion.get(b.templateVersionId) ?? new Set<number>();
      set.add(n);
      photoNumbersByVersion.set(b.templateVersionId, set);
    }

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        group: t.ownerUserId === user.id ? "Mis plantillas" : "Catálogo",
        photoInputs: t.currentVersionId ? (photoNumbersByVersion.get(t.currentVersionId)?.size ?? 0) : 0,
      })),
    });
  } catch (e) {
    console.error("preventa-packs template-options GET:", e);
    return NextResponse.json({ error: "Error al listar plantillas" }, { status: 500 });
  }
}
