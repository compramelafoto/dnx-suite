import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  isTicketClosedForUserReply,
  userCanAccessTicket,
} from "@/lib/support/access";
import {
  sanitizeMessageBody,
  toPublicSupportMessage,
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
 * Anti-enumeración: 404 tanto si no existe como si no hay acceso.
 */
function denyTicket() {
  return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
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
    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const access = await userCanAccessTicket(
      user.id,
      user.role,
      user.email,
      ticketId
    );
    if (!access.allowed || !access.ticket) {
      return denyTicket();
    }

    const messages = await prisma.supportMessage.findMany({
      where: { ticketId, isInternal: false },
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

    return NextResponse.json({
      messages: messages.map(toPublicSupportMessage),
    });
  } catch (err: unknown) {
    console.error("GET /api/support/tickets/[id]/messages ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo mensajes" },
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
    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const ip = clientIp(req);
    const rl = checkRateLimit({
      key: `support-msg:${user.id}:${ticketId}:${ip}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiados mensajes. Intentá más tarde." },
        { status: 429 }
      );
    }

    const access = await userCanAccessTicket(
      user.id,
      user.role,
      user.email,
      ticketId
    );
    if (!access.allowed || !access.ticket) {
      return denyTicket();
    }

    if (isTicketClosedForUserReply(access.ticket.status)) {
      return NextResponse.json(
        { error: "Este ticket está cerrado y no admite nuevas respuestas" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = sanitizeMessageBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const created = await prisma.supportMessage.create({
      data: {
        ticketId,
        message: parsed.message,
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

    try {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      });
    } catch {
      /* no bloquear */
    }

    if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
      try {
        const t = access.ticket;
        const displayName = (user.name && user.name.trim()) || user.email || "Usuario";
        const reasonLine = t.reason?.trim() || "(sin motivo)";
        const preview =
          parsed.message.length > 280
            ? `${parsed.message.slice(0, 280)}…`
            : parsed.message;
        await prisma.adminSystemMessage.create({
          data: {
            type: `SUPPORT_USER_REPLY:${ticketId}`,
            title: "Nueva respuesta en soporte",
            body: `Ticket #${ticketId} · ${reasonLine}\n${displayName} · ${user.email}\n\n${preview}`,
            isRead: false,
          },
        });
      } catch (notifyErr) {
        console.error("[support-user-reply] aviso admin no creado:", notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: toPublicSupportMessage({ ...created, isInternal: false }),
    });
  } catch (err: unknown) {
    console.error("POST /api/support/tickets/[id]/messages ERROR >>>", err);
    return NextResponse.json(
      { error: "Error enviando mensaje" },
      { status: 500 }
    );
  }
}
