import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { normalizePreviewUrl } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/design-tasks
 * Lista de ítems de pedidos de pre-venta que tienen selección de fotos (para diseñar).
 * Cada ítem incluye las fotos que el cliente seleccionó, para usar en el diseñador.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const albumId = parseInt(id, 10);
    if (!Number.isInteger(albumId) || albumId <= 0) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { userId: true },
    });
    if (!album || album.userId !== user.id) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const orders = await prisma.preCompraOrder.findMany({
      where: { albumId },
      include: {
        items: {
          where: {
            selection: { isNot: null },
          },
          include: {
            albumProduct: { select: { id: true, name: true, requiresDesign: true } },
            subject: { select: { id: true, label: true } },
            selection: {
              include: {
                photos: {
                  orderBy: { position: "asc" },
                  include: {
                    photo: {
                      select: { id: true, originalKey: true, previewUrl: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const tasks: Array<{
      orderItemId: number;
      orderId: number;
      buyerEmail: string;
      productName: string;
      subjectLabel: string | null;
      images: Array<{ id: string; url: string; name: string }>;
    }> = [];

    for (const order of orders) {
      for (const item of order.items) {
        const sel = item.selection;
        if (!sel?.photos?.length) continue;

        const images = sel.photos.map((sp, idx) => {
          const photo = sp.photo;
          const url = normalizePreviewUrl(photo.previewUrl, photo.originalKey) || photo.previewUrl || "";
          return {
            id: `photo-${photo.id}`,
            url,
            name: `Foto ${idx + 1}`,
          };
        });

        tasks.push({
          orderItemId: item.id,
          orderId: order.id,
          buyerEmail: order.buyerEmail,
          productName: item.albumProduct.name,
          subjectLabel: item.subject?.label ?? null,
          images,
        });
      }
    }

    return NextResponse.json({ tasks });
  } catch (e) {
    console.error("design-tasks GET error:", e);
    return NextResponse.json({ error: "Error al cargar tareas de diseño" }, { status: 500 });
  }
}
