import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { EventMemberStatus, Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/public/events/[shareSlug]/leave
 * Desinscribe (ACTIVE → remove) o cancela solicitud PENDING.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ shareSlug: string }> | { shareSlug: string } },
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { shareSlug } = await Promise.resolve(params);
    const event = await prisma.event.findUnique({
      where: { shareSlug },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const member = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
    });
    if (!member) {
      return NextResponse.json({ success: true, message: "No estabas inscrito." });
    }

    if (
      member.status === EventMemberStatus.ACTIVE ||
      member.status === EventMemberStatus.PENDING
    ) {
      await prisma.eventMember.delete({ where: { id: member.id } });
    }

    return NextResponse.json({ success: true, message: "Te desinscribiste del evento." });
  } catch (err: unknown) {
    console.error("DELETE /api/public/events/[shareSlug]/leave ERROR >>>", err);
    return NextResponse.json({ error: "Error al desinscribirse" }, { status: 500 });
  }
}
