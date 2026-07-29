import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { notifyNearbyPhotographersForEvent } from "@/lib/event-nearby-photographer-invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/organizer/events/[id]/invite
 * Invitación manual a fotógrafos cercanos (respeta radio individual de cada fotógrafo).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const creatorName = user.name || user.email || "El organizador";
    const result = await notifyNearbyPhotographersForEvent({
      eventId,
      creatorName,
    });

    return NextResponse.json({
      ok: true,
      invited: result.invited,
      found: result.found,
      message: result.message,
    });
  } catch (err: unknown) {
    console.error("POST /api/organizer/events/[id]/invite ERROR >>>", err);
    return NextResponse.json(
      {
        error: "No pudimos enviar la invitación a los fotógrafos cercanos. Intentá nuevamente.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
