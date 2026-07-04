import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function userCanAccessTicket(userId: number, role: Role, userEmail: string, ticketId: number) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      printOrder: {
        select: {
          id: true,
          clientId: true,
          photographerId: true,
          labId: true,
        },
      },
    },
  });

  if (!ticket) {
    return { allowed: false, ticket: null };
  }

  if (role === Role.ADMIN) {
    return { allowed: true, ticket };
  }

  const emailMatch = ticket.requesterEmail && userEmail && ticket.requesterEmail.toLowerCase() === userEmail.toLowerCase();

  if (role === Role.CUSTOMER) {
    return { allowed: ticket.printOrder?.clientId === userId || emailMatch, ticket };
  }

  if (role === Role.PHOTOGRAPHER || role === Role.LAB_PHOTOGRAPHER) {
    return { allowed: ticket.printOrder?.photographerId === userId || emailMatch, ticket };
  }

  if (role === Role.LAB) {
    const lab = await prisma.lab.findFirst({
      where: { userId },
      select: { id: true },
    });
    return { allowed: (Boolean(lab && ticket.printOrder?.labId === lab.id) || emailMatch), ticket };
  }

  return { allowed: emailMatch, ticket };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const access = await userCanAccessTicket(user.id, user.role, user.email, ticketId);
    if (!access.allowed) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const messages = await prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        message: true,
        isInternal: true,
        authorId: true,
        authorName: true,
        authorEmail: true,
        author: { select: { name: true, email: true, role: true } },
      },
    });

    return NextResponse.json({ messages });
  } catch (err: any) {
    console.error("GET /api/support/tickets/[id]/messages ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo mensajes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const access = await userCanAccessTicket(user.id, user.role, user.email, ticketId);
    if (!access.allowed) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "El mensaje es requerido" }, { status: 400 });
    }

    const created = await prisma.supportMessage.create({
      data: {
        ticketId,
        message,
        isInternal: false,
        authorId: user.id,
        authorName: user.name || null,
        authorEmail: user.email || null,
      },
      select: {
        id: true,
        createdAt: true,
        message: true,
        authorId: true,
        authorName: true,
        authorEmail: true,
      },
    });

    return NextResponse.json({ success: true, message: created });
  } catch (err: any) {
    console.error("POST /api/support/tickets/[id]/messages ERROR >>>", err);
    return NextResponse.json(
      { error: "Error enviando mensaje", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
