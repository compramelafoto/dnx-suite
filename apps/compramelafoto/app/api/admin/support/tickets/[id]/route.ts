import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { SupportTicketStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const status = (body.status ?? "").toString().toUpperCase();

    if (!VALID_STATUSES.includes(status as SupportTicketStatus)) {
      return NextResponse.json(
        { error: "Estado inválido. Usar: OPEN, IN_PROGRESS, RESOLVED, CLOSED" },
        { status: 400 }
      );
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: status as SupportTicketStatus,
        ...(status === "RESOLVED" || status === "CLOSED"
          ? { resolvedAt: new Date(), resolutionNote: body.resolutionNote ?? null }
          : {}),
      },
    });

    return NextResponse.json({ ticket });
  } catch (err: any) {
    console.error("PATCH /api/admin/support/tickets/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando ticket", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        printOrder: {
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ticket });
  } catch (err: any) {
    console.error("GET /api/admin/support/tickets/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo ticket", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
