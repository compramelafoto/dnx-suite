import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/albums/[id]/precompra-products/[productId]/templates/assign
 * Asigna una plantilla de la biblioteca del álbum a este producto (copia la plantilla al producto).
 * Body: { templateId: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = parseInt((await params).id, 10);
    const productId = parseInt((await params).productId, 10);
    if (!Number.isInteger(albumId) || !Number.isInteger(productId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const product = await prisma.albumProduct.findFirst({
      where: { id: productId, albumId },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const templateId = typeof body?.templateId === "number" ? body.templateId : parseInt(String(body?.templateId ?? ""), 10);
    if (!Number.isInteger(templateId)) {
      return NextResponse.json({ error: "templateId es requerido" }, { status: 400 });
    }

    const sourceTemplate = await prisma.template.findFirst({
      where: {
        id: templateId,
        albumProductId: null,
        OR: [
          { albumId, albumProductId: null },
          { albumId: null, isSystemTemplate: true },
        ],
      },
      include: { slots: { orderBy: { index: "asc" } } },
    });
    if (!sourceTemplate) {
      return NextResponse.json({ error: "Plantilla no encontrada, no es de la biblioteca de este álbum o no es una plantilla pública del sistema" }, { status: 404 });
    }

    const newTemplate = await prisma.template.create({
      data: {
        albumId,
        albumProductId: productId,
        name: sourceTemplate.name,
        imageUrl: sourceTemplate.imageUrl,
        widthCm: sourceTemplate.widthCm,
        heightCm: sourceTemplate.heightCm,
        greenColorHex: sourceTemplate.greenColorHex,
        tolerance: sourceTemplate.tolerance,
        safeAreaConfigJson: sourceTemplate.safeAreaConfigJson as Prisma.InputJsonValue,
        textElementsJson: sourceTemplate.textElementsJson as Prisma.InputJsonValue | undefined,
        pagesJson: sourceTemplate.pagesJson as Prisma.InputJsonValue | undefined,
        slots: {
          create: sourceTemplate.slots.map((s) => ({
            index: s.index,
            bbox: s.bbox as object,
            maskPngUrl: s.maskPngUrl,
          })),
        },
      },
      include: { slots: { orderBy: { index: "asc" } } },
    });

    const productTemplatesCount = await prisma.template.count({
      where: { albumProductId: productId },
    });
    if (productTemplatesCount === 1) {
      await prisma.albumProduct.update({
        where: { id: productId },
        data: { defaultTemplateId: newTemplate.id },
      });
    }

    return NextResponse.json({ template: newTemplate });
  } catch (e) {
    console.error("templates assign error:", e);
    return NextResponse.json({ error: "Error al asignar plantilla" }, { status: 500 });
  }
}
