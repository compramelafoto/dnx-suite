import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getEventAndCheck(req: NextRequest, eventId: number) {
  const { error, user } = await requireAuth([Role.ORGANIZER]);
  if (error || !user) return { error: true, status: 401 as const, message: error || "No autorizado" };
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, creatorId: true },
  });
  if (!event) return { error: true, status: 404 as const, message: "Evento no encontrado" };
  if (event.creatorId !== user.id) return { error: true, status: 403 as const, message: "No podés editar este evento" };
  return { error: false as const, user, event };
}

/**
 * GET /api/organizer/events/[id]/invitations
 * Lista los fotógrafos invitados al evento (solo para eventos privados).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const check = await getEventAndCheck(req, eventId);
    if (check.error) {
      return NextResponse.json({ error: check.message }, { status: check.status });
    }

    const invitations = await prisma.eventInvitation.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            companyName: true,
            companyOwner: true,
            phone: true,
            city: true,
          },
        },
      },
      orderBy: { invitedAt: "asc" },
    });

    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        userId: inv.userId,
        invitedAt: inv.invitedAt,
        name: inv.user.name ?? undefined,
        email: inv.user.email,
        companyName: inv.user.companyName ?? undefined,
        companyOwner: inv.user.companyOwner ?? undefined,
        phone: inv.user.phone ?? undefined,
        city: inv.user.city ?? undefined,
      })),
    });
  } catch (err: any) {
    console.error("GET /api/organizer/events/[id]/invitations ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando invitados", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/organizer/events/[id]/invitations
 * Reemplaza la lista de fotógrafos invitados. Body: { userIds: number[] }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const check = await getEventAndCheck(req, eventId);
    if (check.error) {
      return NextResponse.json({ error: check.message }, { status: check.status });
    }

    const body = await req.json().catch(() => ({}));
    const userIds = Array.isArray(body.userIds) ? body.userIds : [];
    const validIds: number[] = userIds
      .filter((id: unknown) => Number.isFinite(Number(id)))
      .map((id: unknown) => Number(id));
    const uniqueIds = [...new Set(validIds)];

    await prisma.$transaction([
      prisma.eventInvitation.deleteMany({ where: { eventId } }),
      ...uniqueIds.map((userId: number) =>
        prisma.eventInvitation.create({
          data: { eventId, userId },
        })
      ),
    ]);

    return NextResponse.json({ success: true, count: uniqueIds.length });
  } catch (err: any) {
    console.error("PUT /api/organizer/events/[id]/invitations ERROR >>>", err);
    return NextResponse.json(
      { error: "Error guardando invitados", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
