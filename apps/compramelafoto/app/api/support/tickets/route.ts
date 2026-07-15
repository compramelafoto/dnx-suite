import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildUserTicketsWhere } from "@/lib/support/access";
import {
  sanitizeCreateTicketBody,
  toPublicSupportTicket,
} from "@/lib/support/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * POST /api/support/tickets — crear incidencia (sesión obligatoria).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: "Debés iniciar sesión para crear un ticket" },
        { status: 401 }
      );
    }

    const ip = clientIp(req);
    const rl = checkRateLimit({
      key: `support-create:${user.id}:${ip}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá más tarde." },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = sanitizeCreateTicketBody(body, {
      name: user.name,
      email: user.email,
      role: user.role,
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const data = parsed.data;

    // Forzar identidad de sesión: no permitir suplantar email de otro usuario
    data.requesterEmail = user.email.toLowerCase();
    data.requesterName = data.requesterName || user.name || null;

    if (data.printOrderId) {
      const order = await prisma.printOrder.findUnique({
        where: { id: data.printOrderId },
        select: {
          id: true,
          clientId: true,
          photographerId: true,
          labId: true,
        },
      });
      if (!order) {
        return NextResponse.json({ error: "El pedido no existe" }, { status: 404 });
      }

      const isAdmin =
        user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
      let hasAccess =
        isAdmin ||
        order.clientId === user.id ||
        order.photographerId === user.id;

      if (!hasAccess && user.role === Role.LAB) {
        const lab = await prisma.lab.findFirst({
          where: { userId: user.id },
          select: { id: true },
        });
        hasAccess = Boolean(lab && order.labId === lab.id);
      }

      if (!hasAccess) {
        return NextResponse.json(
          { error: "No tenés acceso a este pedido" },
          { status: 403 }
        );
      }
    }

    // Descripción vive en el ticket (UI la muestra aparte); mensajes son respuestas.
    const ticket = await prisma.supportTicket.create({
      data: {
        printOrderId: data.printOrderId,
        reason: data.reason,
        description: data.description,
        requesterName: data.requesterName,
        requesterEmail: data.requesterEmail,
        requesterPhone: data.requesterPhone,
        requesterRole: data.requesterRole,
        status: "OPEN",
      },
      select: { id: true, createdAt: true },
    });

    try {
      await prisma.adminSystemMessage.create({
        data: {
          type: `SUPPORT_TICKET_CREATED:${ticket.id}`,
          title: "Nueva incidencia de soporte",
          body: `Ticket #${ticket.id} · ${data.reason}\n${data.requesterName || user.email} · ${user.email}\n\n${data.description.slice(0, 280)}${data.description.length > 280 ? "…" : ""}`,
          isRead: false,
        },
      });
    } catch (notifyErr) {
      console.error("[support-create] aviso admin no creado:", notifyErr);
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        createdAt: ticket.createdAt,
      },
    });
  } catch (err: unknown) {
    console.error("POST /api/support/tickets ERROR >>>", err);
    return NextResponse.json({ error: "Error creando ticket" }, { status: 500 });
  }
}

/**
 * GET /api/support/tickets — listado propio (o admin).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: "Debés iniciar sesión para ver tus tickets" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const printOrderRaw = searchParams.get("printOrderId");
    const printOrderId =
      printOrderRaw && Number.isFinite(Number(printOrderRaw))
        ? Number(printOrderRaw)
        : null;

    const where = await buildUserTicketsWhere({
      userId: user.id,
      role: user.role,
      email: user.email,
      printOrderId,
    });

    if (where === null) {
      return NextResponse.json({ tickets: [] });
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        reason: true,
        description: true,
        status: true,
        printOrderId: true,
        requesterName: true,
        requesterEmail: true,
        requesterRole: true,
        printOrder: {
          select: {
            id: true,
            customerName: true,
          },
        },
        messages: {
          where: { isInternal: false },
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
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({
      tickets: tickets.map(toPublicSupportTicket),
    });
  } catch (err: unknown) {
    console.error("GET /api/support/tickets ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo tickets" },
      { status: 500 }
    );
  }
}
