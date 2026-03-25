import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/public/events/[shareSlug]/join
 * Inscribe al usuario actual (fotógrafo o lab fotógrafo) en el evento.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { shareSlug: string } | Promise<{ shareSlug: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "Debes iniciar sesión como fotógrafo" }, { status: 401 });
    }

    const { shareSlug } = await Promise.resolve(params);
    if (!shareSlug || typeof shareSlug !== "string") {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { shareSlug },
      include: { _count: { select: { members: true } }, invitedPhotographers: { select: { userId: true } } },
    });
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const isPrivateOrInviteOnly =
      event.visibility === "PRIVATE" || event.joinPolicy === "INVITE_ONLY";
    if (isPrivateOrInviteOnly) {
      const invitedUserIds = (event.invitedPhotographers ?? []).map((i) => i.userId);
      if (!invitedUserIds.includes(user.id)) {
        return NextResponse.json(
          { error: "Este evento es privado. Solo los fotógrafos invitados pueden inscribirse." },
          { status: 403 }
        );
      }
    }

    const existing = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
    });
    if (existing) {
      return NextResponse.json({ message: "Ya estás inscrito en este evento", alreadyMember: true });
    }

    const max = event.maxPhotographers ?? null;
    if (max !== null && event._count.members >= max) {
      return NextResponse.json(
        { error: "El evento ya alcanzó el cupo máximo de fotógrafos" },
        { status: 400 }
      );
    }

    await prisma.eventMember.create({
      data: {
        eventId: event.id,
        userId: user.id,
        role: "PHOTOGRAPHER",
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ success: true, message: "Te inscribiste correctamente al evento" });
  } catch (err: any) {
    console.error("POST /api/public/events/[shareSlug]/join ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al inscribirse", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
