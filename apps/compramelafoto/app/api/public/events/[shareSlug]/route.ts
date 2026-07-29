import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";
import {
  canAccessEventByShareSlug,
  toPublicEventDetail,
} from "@/lib/public/public-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/events/[shareSlug]
 * Datos públicos para /e/[shareSlug]. PUBLIC y UNLISTED; PRIVATE/archivado → 404.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareSlug: string }> }
) {
  try {
    const { shareSlug } = await Promise.resolve(params);
    if (!shareSlug || typeof shareSlug !== "string") {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { shareSlug },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        status: true,
        visibility: true,
        archivedAt: true,
        startsAt: true,
        endsAt: true,
        locationName: true,
        city: true,
        accreditationNotes: true,
        photographerTerms: true,
        uploadsEnabled: true,
        maxPhotographers: true,
        expectedAttendees: true,
        joinPolicy: true,
        coverImageKey: true,
        _count: { select: { members: true } },
      },
    });

    if (!event || !canAccessEventByShareSlug(event)) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const coverUrl = event.coverImageKey
      ? getR2PublicUrl(event.coverImageKey)
      : null;

    return NextResponse.json(
      toPublicEventDetail({
        id: event.id,
        title: event.title,
        description: event.description,
        type: event.type,
        status: event.status,
        visibility: event.visibility,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        locationName: event.locationName,
        city: event.city,
        accreditationNotes: event.accreditationNotes,
        photographerTerms: event.photographerTerms,
        uploadsEnabled: event.uploadsEnabled,
        maxPhotographers: event.maxPhotographers,
        expectedAttendees: event.expectedAttendees,
        joinPolicy: event.joinPolicy,
        membersCount: event._count.members,
        coverUrl,
      })
    );
  } catch (err: unknown) {
    console.error("GET /api/public/events/[shareSlug] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo evento" },
      { status: 500 }
    );
  }
}
