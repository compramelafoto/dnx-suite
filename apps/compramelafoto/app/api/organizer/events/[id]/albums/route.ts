import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/organizer/events/[id]/albums
 * Lista los álbumes vinculados al evento (solo si el organizador es el creador del evento).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, creatorId: true },
    });
    if (!event || event.creatorId !== user.id) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const albums = await prisma.album.findMany({
      where: { eventId, deletedAt: null },
      select: {
        id: true,
        title: true,
        publicSlug: true,
        maxDownloadAllowed: true,
        user: { select: { id: true, name: true, email: true } },
        photos: { where: { isRemoved: false }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const list = albums.map((a) => ({
      id: a.id,
      title: a.title,
      publicSlug: a.publicSlug,
      maxDownloadAllowed: a.maxDownloadAllowed,
      user: a.user,
      photosCount: a.photos.length,
    }));

    return NextResponse.json(list);
  } catch (err: any) {
    console.error("GET /api/organizer/events/[id]/albums ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando álbumes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
