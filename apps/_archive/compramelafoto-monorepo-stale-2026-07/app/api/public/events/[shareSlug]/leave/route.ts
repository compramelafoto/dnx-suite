import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/public/events/[shareSlug]/leave
 * El fotógrafo se desinscribe del evento.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { shareSlug: string } | Promise<{ shareSlug: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "Debes iniciar sesión como fotógrafo" }, { status: 401 });
    }

    const { shareSlug } = await Promise.resolve(params);
    if (!shareSlug || typeof shareSlug !== "string") {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({ where: { shareSlug } });
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const member = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
    });
    if (!member) {
      return NextResponse.json({ error: "No estás inscrito en este evento" }, { status: 400 });
    }

    await prisma.eventMember.delete({
      where: { id: member.id },
    });

    return NextResponse.json({ success: true, message: "Te desinscribiste del evento" });
  } catch (err: any) {
    console.error("DELETE /api/public/events/[shareSlug]/leave ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al desinscribirse", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
