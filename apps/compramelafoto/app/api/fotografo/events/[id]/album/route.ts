import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getOrCreateEventAlbumForUser } from "@/lib/events/event-album";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/fotografo/events/[id]/album
 * Crea (o retorna) el álbum interno del fotógrafo para el evento.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const membership = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId, userId: user.id } },
      include: { event: true },
    });
    if (!membership || membership.status !== "ACTIVE") {
      return NextResponse.json({ error: "No estás inscrito en este evento" }, { status: 403 });
    }

    const event = membership.event;
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const album = await getOrCreateEventAlbumForUser({
      event,
      user: { id: user.id, name: user.name ?? null },
      enforceUploadsGate: true,
    });

    if (!album) {
      return NextResponse.json(
        { error: "La subida de fotos todavía no está habilitada para este evento." },
        { status: 400 }
      );
    }

    return NextResponse.json(album);
  } catch (err: any) {
    console.error("POST /api/fotografo/events/[id]/album ERROR >>>", err);
    return NextResponse.json(
      { error: "Error preparando álbum del evento", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
