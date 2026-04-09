import { NextRequest, NextResponse } from "next/server";
import { PreCompraOrderItemStatus, Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — Persiste selección de fotos y pasa el ítem a READY_TO_DESIGN (panel fotógrafo / operador).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ albumId: string; orderItemId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { albumId: aid, orderItemId: oi } = await params;
    const albumId = parseInt(aid, 10);
    const orderItemId = parseInt(oi, 10);
    const body = await req.json().catch(() => ({}));
    const photoIds = Array.isArray(body.photoIds)
      ? body.photoIds.map((x: unknown) => Number(x)).filter((n: number): n is number => Number.isInteger(n))
      : [];

    if (!Number.isInteger(albumId) || !Number.isInteger(orderItemId) || photoIds.length === 0) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const item = await prisma.preCompraOrderItem.findFirst({
      where: {
        id: orderItemId,
        order: { albumId, album: { userId: user.id } },
      },
      include: { albumProduct: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }

    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds }, albumId },
      select: { id: true },
    });
    if (photos.length !== photoIds.length) {
      return NextResponse.json({ error: "Alguna foto no pertenece al álbum" }, { status: 400 });
    }

    if (photoIds.length < item.albumProduct.minFotos || photoIds.length > item.albumProduct.maxFotos) {
      return NextResponse.json(
        { error: `Cantidad de fotos fuera de rango (${item.albumProduct.minFotos}–${item.albumProduct.maxFotos})` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const sel =
        (await tx.selection.findUnique({ where: { orderItemId: item.id } })) ??
        (await tx.selection.create({ data: { orderItemId: item.id } }));

      await tx.selectionPhoto.deleteMany({ where: { selectionId: sel.id } });
      await tx.selectionPhoto.createMany({
        data: photoIds.map((photoId: number, idx: number) => ({
          selectionId: sel.id,
          photoId,
          position: idx,
        })),
      });

      await tx.preCompraOrderItem.update({
        where: { id: item.id },
        data: { status: PreCompraOrderItemStatus.READY_TO_DESIGN },
      });
    });

    console.log("[school_redeem_design_gate] selection saved", { orderItemId, n: photoIds.length });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[school_redeem_design_gate] selection POST", e);
    return NextResponse.json({ error: "Error al guardar selección" }, { status: 500 });
  }
}
