import { NextRequest, NextResponse } from "next/server";
import { EventMemberRole, EventMemberStatus, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrollPhotographerInEvent } from "@/lib/events/enroll-event-photographer";
import { assertOrganizerOwnsEvent } from "@/lib/organizer-event-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_ORDER: Record<EventMemberStatus, number> = {
  [EventMemberStatus.PENDING]: 0,
  [EventMemberStatus.ACTIVE]: 1,
  [EventMemberStatus.REJECTED]: 2,
};

/**
 * GET /api/organizer/events/[id]/members
 * Lista miembros fotógrafos del evento (pendientes, activos, rechazados).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const access = await assertOrganizerOwnsEvent(eventId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }

    const rows = await prisma.eventMember.findMany({
      where: { eventId, role: EventMemberRole.PHOTOGRAPHER },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, whatsapp: true } },
      },
    });

    rows.sort((a, b) => {
      const oa = STATUS_ORDER[a.status] ?? 99;
      const ob = STATUS_ORDER[b.status] ?? 99;
      if (oa !== ob) return oa - ob;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json(
      rows.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        whatsapp: m.user.whatsapp,
        status: m.status,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
        termsAcceptedAt: m.termsAcceptedAt?.toISOString() ?? null,
      }))
    );
  } catch (err: unknown) {
    console.error("GET /api/organizer/events/[id]/members ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando miembros", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizer/events/[id]/members
 * Inscribe manualmente a un fotógrafo (eventos abiertos o con aprobación).
 * Body: { userId: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const access = await assertOrganizerOwnsEvent(eventId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }

    const body = await req.json().catch(() => ({}));
    const userId = Number(body.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "userId inválido" }, { status: 400 });
    }

    const result = await enrollPhotographerInEvent({
      event: access.event,
      userId,
      byOrganizer: true,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    const messages: Record<typeof result.outcome, string> = {
      enrolled: "Fotógrafo inscripto correctamente.",
      reactivated: "Fotógrafo inscripto nuevamente en el evento.",
      already_active: "Ese fotógrafo ya estaba inscripto en el evento.",
    };

    return NextResponse.json({
      success: true,
      outcome: result.outcome,
      memberId: result.memberId,
      albumId: result.albumId,
      publicSlug: result.publicSlug,
      message: messages[result.outcome],
    });
  } catch (err: unknown) {
    console.error("POST /api/organizer/events/[id]/members ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al inscribir fotógrafo", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
