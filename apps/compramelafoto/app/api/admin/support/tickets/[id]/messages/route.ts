import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { sendEmail } from "@/emails/send";
import { buildSupportReplyEmail } from "@/emails/templates/support-reply";
import { getSupportUrlForRole } from "@/lib/support-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
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

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message ?? "").trim();
    const markAsResolved = Boolean(body?.markAsResolved);
    if (!message) {
      return NextResponse.json({ error: "El mensaje es requerido" }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { printOrder: { select: { id: true } } },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
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

    if (markAsResolved) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolutionNote: message,
        },
      });
    }

    const toEmail = ticket.requesterEmail;
    const supportUrl = getSupportUrlForRole(ticket.requesterRole);
    if (toEmail) {
      try {
        const { subject, html } = buildSupportReplyEmail({
          requesterName: ticket.requesterName,
          ticketId,
          message,
          supportUrl,
          adminName: user.name,
        });
        await sendEmail({
          to: toEmail,
          subject,
          html,
          templateKey: "SUPPORT_REPLY",
        });
        await prisma.supportTicket.update({
          where: { id: ticketId },
          data: { lastReplyEmailSentAt: new Date() },
        });
      } catch (emailErr: unknown) {
        console.error("Error enviando email de respuesta soporte:", emailErr);
      }
    }

    const userByEmail = toEmail
      ? await prisma.user.findUnique({
          where: { email: toEmail.toLowerCase() },
          select: { id: true },
        })
      : null;
    if (userByEmail) {
      try {
        await prisma.dashboardNotification.create({
          data: {
            userId: userByEmail.id,
            type: "SUPPORT_REPLY",
            title: `Nueva respuesta en incidencia #${ticketId}`,
            body: message.slice(0, 150) + (message.length > 150 ? "…" : ""),
            link: supportUrl,
          },
        });
      } catch (notifErr: unknown) {
        console.error("Error creando notificación in-app:", notifErr);
      }
    }

    const updatedTicket = markAsResolved
      ? await prisma.supportTicket.findUnique({
          where: { id: ticketId },
          select: { status: true, resolvedAt: true },
        })
      : null;

    return NextResponse.json({
      success: true,
      message: created,
      ...(updatedTicket && { ticket: updatedTicket }),
    });
  } catch (err: unknown) {
    console.error("POST /api/admin/support/tickets/[id]/messages ERROR >>>", err);
    return NextResponse.json(
      { error: "Error enviando mensaje", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
