import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  studentNotes?: unknown;
  /** true = marcar ahora; false = desmarcar (quitar fecha y responsable). */
  photosTaken?: unknown;
};

/**
 * PATCH /api/dashboard/albums/[id]/school-operations/[orderId]
 * Actualiza observaciones y/o estado "fotos tomadas" en el pedido de preventa del álbum.
 */
export async function PATCH(
  req: NextRequest,
  context: {
    params: { id: string; orderId: string } | Promise<{ id: string; orderId: string }>;
  }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id, orderId: orderIdRaw } = await Promise.resolve(context.params);
    const albumId = parseInt(id, 10);
    const orderId = parseInt(orderIdRaw, 10);
    if (!Number.isInteger(albumId) || albumId <= 0 || !Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const owned = await findAlbumOwnedByUser(albumId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const existing = await prisma.preCompraOrder.findFirst({
      where: { id: orderId, albumId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pedido no encontrado en este álbum" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const data: {
      studentNotes?: string | null;
      photosTakenAt?: Date | null;
      photosTakenByUserId?: number | null;
    } = {};

    if (body.studentNotes !== undefined) {
      const raw = body.studentNotes;
      if (raw === null || raw === "") {
        data.studentNotes = null;
      } else {
        data.studentNotes = String(raw).trim().slice(0, 4000);
      }
    }

    if (body.photosTaken !== undefined) {
      if (body.photosTaken === true) {
        data.photosTakenAt = new Date();
        data.photosTakenByUserId = user.id;
      } else if (body.photosTaken === false) {
        data.photosTakenAt = null;
        data.photosTakenByUserId = null;
      } else {
        return NextResponse.json({ error: "photosTaken debe ser true o false" }, { status: 400 });
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
    }

    const updated = await prisma.preCompraOrder.update({
      where: { id: orderId },
      data,
      select: {
        id: true,
        studentNotes: true,
        photosTakenAt: true,
        photosTakenByUserId: true,
      },
    });

    return NextResponse.json({
      id: updated.id,
      studentNotes: updated.studentNotes,
      photosTakenAt: updated.photosTakenAt?.toISOString() ?? null,
      photosTakenByUserId: updated.photosTakenByUserId,
    });
  } catch (e) {
    console.error("PATCH /api/dashboard/albums/[id]/school-operations/[orderId]:", e);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}
