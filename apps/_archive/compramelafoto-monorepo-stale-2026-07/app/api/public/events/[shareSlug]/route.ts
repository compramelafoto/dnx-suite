import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/events/[shareSlug]
 * Datos públicos del evento para la página de invitación (sin auth).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { shareSlug: string } | Promise<{ shareSlug: string }> }
) {
  try {
    const { shareSlug } = await Promise.resolve(params);
    if (!shareSlug || typeof shareSlug !== "string") {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { shareSlug },
      include: { _count: { select: { members: true } } },
    });
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const coverUrl = event.coverImageKey ? getR2PublicUrl(event.coverImageKey) : null;
    return NextResponse.json({
      id: event.id,
      title: event.title,
      description: event.description,
      type: event.type,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      locationName: event.locationName,
      city: event.city,
      accreditationNotes: event.accreditationNotes,
      maxPhotographers: event.maxPhotographers,
      expectedAttendees: event.expectedAttendees,
      membersCount: event._count.members,
      coverUrl,
    });
  } catch (err: any) {
    console.error("GET /api/public/events/[shareSlug] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo evento", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
