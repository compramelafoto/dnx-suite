import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/fotografo/events/[id]/album-context
 * Datos para abrir el modal de nuevo álbum vinculado al evento (precarga) o el álbum ya existente.
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

    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const membership = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId, userId: user.id } },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            locationName: true,
            city: true,
            startsAt: true,
            endsAt: true,
            type: true,
            uploadsEnabled: true,
            archivedAt: true,
          },
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE" || !membership.event) {
      return NextResponse.json({ error: "No estás inscrito en este evento" }, { status: 403 });
    }

    const event = membership.event;
    if (event.archivedAt) {
      return NextResponse.json({ error: "Este evento no está disponible" }, { status: 404 });
    }

    const existing = await prisma.album.findFirst({
      where: { eventId, userId: user.id, deletedAt: null },
      select: { id: true },
    });

    const now = new Date();
    const ended = event.endsAt ? event.endsAt < now : event.startsAt < now;
    const uploadsAllowed = event.uploadsEnabled || ended;

    const eventDateStr = event.startsAt.toISOString().split("T")[0];
    const locationStr = (event.locationName?.trim() || event.city?.trim() || "").trim();

    return NextResponse.json({
      existingAlbumId: existing?.id ?? null,
      uploadsAllowed,
      prefill: {
        title: event.title,
        location: locationStr,
        eventDate: eventDateStr,
      },
    });
  } catch (err: any) {
    console.error("GET /api/fotografo/events/[id]/album-context ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo datos del evento", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
