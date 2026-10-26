import { prisma } from "@/lib/prisma";
import { SUPPORT_MESSAGE_MAX_LENGTH, type CreateTicketInput } from "@/lib/support/sanitize";
import { programarDiagnostico } from "@/lib/soporte/diagnostico/lanzar";

/**
 * Crea una incidencia de soporte (y el aviso al admin). Compartido por la ruta
 * POST /api/support/tickets y por DNX Bot.
 */
export async function createSupportTicket(p: {
  data: CreateTicketInput;
  requesterLabel: string;
  internalNote?: string;
  adminTitle?: string;
}): Promise<{ id: number; createdAt: Date }> {
  const { data } = p;
  // Descripción vive en el ticket (UI la muestra aparte); mensajes son respuestas.
  const ticket = await prisma.supportTicket.create({
    data: {
      printOrderId: data.printOrderId,
      ...(data.orderId != null ? { orderId: data.orderId } : {}),
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

  if (p.internalNote) {
    await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorName: "DNX Bot",
        message: p.internalNote.slice(0, SUPPORT_MESSAGE_MAX_LENGTH),
        isInternal: true,
      },
    });
  }

  try {
    await prisma.adminSystemMessage.create({
      data: {
        type: `SUPPORT_TICKET_CREATED:${ticket.id}`,
        title: p.adminTitle ?? "Nueva incidencia de soporte",
        body: `Ticket #${ticket.id} · ${data.reason}\n${p.requesterLabel}\n\n${data.description.slice(0, 280)}${data.description.length > 280 ? "…" : ""}`,
        isRead: false,
      },
    });
  } catch (notifyErr) {
    console.error("[support-create] aviso admin no creado:", notifyErr);
  }

  try {
    programarDiagnostico(ticket.id);
  } catch (diagErr) {
    console.error("[support-create] diagnóstico no programado:", diagErr);
  }

  return ticket;
}
