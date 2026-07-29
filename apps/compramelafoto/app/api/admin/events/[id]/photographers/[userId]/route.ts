import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { EventMemberRole, EventMemberStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertAdmin(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return { error: error || "No autorizado. Se requiere rol ADMIN.", status: 401 as const };
  }
  return { user };
}

function parseIds(rawEventId: string, rawUserId: string) {
  const eventId = parseInt(rawEventId, 10);
  const userId = parseInt(rawUserId, 10);
  if (!Number.isFinite(eventId) || !Number.isFinite(userId)) return null;
  return { eventId, userId };
}

/**
 * PATCH /api/admin/events/[id]/photographers/[userId]
 * Deshabilita al fotógrafo dentro del evento (status REJECTED).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = await assertAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, userId } = await Promise.resolve(params);
  const parsed = parseIds(id, userId);
  if (!parsed) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const member = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId: parsed.eventId, userId: parsed.userId } },
  });
  if (!member || member.role !== EventMemberRole.PHOTOGRAPHER) {
    return NextResponse.json({ error: "Fotógrafo no encontrado en el evento" }, { status: 404 });
  }

  const updated = await prisma.eventMember.update({
    where: { id: member.id },
    data: { status: EventMemberStatus.REJECTED },
  });

  return NextResponse.json({ success: true, status: updated.status });
}

/**
 * DELETE /api/admin/events/[id]/photographers/[userId]
 * Desinscribe al fotógrafo del evento (remove membership).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = await assertAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, userId } = await Promise.resolve(params);
  const parsed = parseIds(id, userId);
  if (!parsed) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const member = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId: parsed.eventId, userId: parsed.userId } },
  });
  if (!member || member.role !== EventMemberRole.PHOTOGRAPHER) {
    return NextResponse.json({ error: "Fotógrafo no encontrado en el evento" }, { status: 404 });
  }

  await prisma.eventMember.delete({ where: { id: member.id } });
  return NextResponse.json({ success: true });
}
