import { NextRequest, NextResponse } from "next/server";
import { EventMemberRole, EventMemberStatus, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertOrganizerOwnsEvent } from "@/lib/organizer-event-access";
import { getOrCreateEventAlbumForUser } from "@/lib/events/event-album";
import { eventPhotographerAlbumVisibilityForEventJoin } from "@/lib/events/event-photographer-album-visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/organizer/events/[id]/members/[memberId]/approve
 */
export async function POST(
  _req: NextRequest,
  {
    params,
  }: { params: { id: string; memberId: string } | Promise<{ id: string; memberId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id, memberId: memberIdStr } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    const memberId = parseInt(memberIdStr, 10);
    if (!Number.isFinite(eventId) || !Number.isFinite(memberId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const access = await assertOrganizerOwnsEvent(eventId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }

    const member = await prisma.eventMember.findFirst({
      where: { id: memberId, eventId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!member || member.role !== EventMemberRole.PHOTOGRAPHER) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }

    if (member.status !== EventMemberStatus.PENDING) {
      return NextResponse.json(
        { error: "Solo se pueden aprobar solicitudes pendientes." },
        { status: 400 }
      );
    }

    const activePhotographersCount = await prisma.eventMember.count({
      where: {
        eventId,
        role: EventMemberRole.PHOTOGRAPHER,
        status: EventMemberStatus.ACTIVE,
      },
    });

    const max = access.event.maxPhotographers;
    if (max !== null && activePhotographersCount >= max) {
      return NextResponse.json(
        {
          error:
            "El cupo máximo de fotógrafos ya está completo. Aumentá el cupo o rechazá otras solicitudes antes de aprobar.",
        },
        { status: 400 }
      );
    }

    await prisma.eventMember.update({
      where: { id: member.id },
      data: { status: EventMemberStatus.ACTIVE },
    });

    const album = await getOrCreateEventAlbumForUser({
      event: access.event,
      user: { id: member.userId, name: member.user.name ?? null },
    });

    if (album?.id) {
      await prisma.album.update({
        where: { id: album.id },
        data: eventPhotographerAlbumVisibilityForEventJoin(),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Fotógrafo aprobado.",
      albumId: album?.id ?? null,
      publicSlug: album?.publicSlug ?? null,
    });
  } catch (err: unknown) {
    console.error("POST .../members/[memberId]/approve ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al aprobar", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
