import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPE_LABELS: Record<string, string> = {
  PUBLIC_SESSION: "Sesión pública",
  PRIVATE_SESSION: "Sesión privada",
  SPORTS: "Evento deportivo",
  PUBLIC_PHOTOGRAPHY: "Fotografías públicas",
  THEMATIC_SESSIONS: "Sesiones temáticas",
  COMMERCIAL_SESSIONS: "Sesiones comerciales",
  SCHOOL: "Eventos escolares",
  RELIGIOUS: "Eventos religiosos",
  FESTIVAL: "Festival / Fiesta popular",
  CONFERENCE: "Conferencia / Charla",
  CONCERT: "Recital / Concierto",
  CORPORATE: "Corporativo",
  OTHER: "Otro",
  WEDDING: "Boda",
  BIRTHDAY: "Cumpleaños",
  GRADUATION: "Graduación",
};

/**
 * GET /api/fotografo/events-mine
 * Lista los eventos en los que el fotógrafo está inscrito.
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    const memberships = await prisma.eventMember.findMany({
      where: { userId: user.id, status: "ACTIVE", event: { archivedAt: null } },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            shareSlug: true,
            startsAt: true,
            endsAt: true,
            city: true,
            type: true,
            coverImageKey: true,
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const events = memberships
      .filter((m) => m.event != null)
      .map((m) => {
        const e = m.event!;
        return {
          id: e.id,
          title: e.title,
          shareSlug: e.shareSlug,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          city: e.city,
          typeLabel: EVENT_TYPE_LABELS[e.type] ?? e.type,
          coverUrl: e.coverImageKey ? getR2PublicUrl(e.coverImageKey) : null,
          membersCount: e._count.members,
          isPast: e.startsAt < now,
        };
      });

    return NextResponse.json(events);
  } catch (err: any) {
    console.error("GET /api/fotografo/events-mine ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando eventos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
