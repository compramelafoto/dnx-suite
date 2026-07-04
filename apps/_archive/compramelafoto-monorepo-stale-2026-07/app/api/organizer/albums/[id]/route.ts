import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/organizer/albums/[id]
 * Actualiza maxDownloadAllowed de un álbum (solo si el álbum pertenece a un evento del organizador).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: { event: { select: { creatorId: true } } },
    });
    if (!album || !album.event || album.event.creatorId !== user.id) {
      return NextResponse.json({ error: "Álbum no encontrado o no pertenece a tu evento" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { maxDownloadAllowed } = body;
    const value =
      maxDownloadAllowed == null || maxDownloadAllowed === ""
        ? null
        : Math.max(0, parseInt(String(maxDownloadAllowed), 10));
    if (value !== null && !Number.isFinite(value)) {
      return NextResponse.json({ error: "maxDownloadAllowed debe ser un número" }, { status: 400 });
    }

    const updated = await prisma.album.update({
      where: { id: albumId },
      data: { maxDownloadAllowed: value },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PATCH /api/organizer/albums/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando álbum", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
