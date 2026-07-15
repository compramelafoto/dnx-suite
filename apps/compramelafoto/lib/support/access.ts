import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { isTicketClosedForUserReply } from "@/lib/support/sanitize";

export { isTicketClosedForUserReply };

export type SupportTicketAccessRow = {
  id: number;
  reason: string | null;
  description: string;
  status: string;
  requesterEmail: string | null;
  requesterName: string | null;
  requesterPhone: string | null;
  requesterRole: string | null;
  printOrderId: number | null;
  createdAt: Date;
  updatedAt: Date;
  printOrder: {
    id: number;
    clientId: number | null;
    photographerId: number | null;
    labId: number | null;
  } | null;
};

/**
 * ¿Puede el usuario ver/responder este ticket? (panel usuario; admin siempre sí).
 */
export async function userCanAccessTicket(
  userId: number,
  role: Role,
  userEmail: string,
  ticketId: number
): Promise<{ allowed: boolean; ticket: SupportTicketAccessRow | null }> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      reason: true,
      description: true,
      status: true,
      requesterEmail: true,
      requesterName: true,
      requesterPhone: true,
      requesterRole: true,
      printOrderId: true,
      createdAt: true,
      updatedAt: true,
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

  if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
    return { allowed: true, ticket };
  }

  const emailMatch =
    Boolean(ticket.requesterEmail && userEmail) &&
    ticket.requesterEmail!.toLowerCase() === userEmail.toLowerCase();

  if (role === Role.CUSTOMER) {
    return {
      allowed: ticket.printOrder?.clientId === userId || emailMatch,
      ticket,
    };
  }

  if (role === Role.PHOTOGRAPHER || role === Role.LAB_PHOTOGRAPHER) {
    return {
      allowed: ticket.printOrder?.photographerId === userId || emailMatch,
      ticket,
    };
  }

  if (role === Role.LAB) {
    const lab = await prisma.lab.findFirst({
      where: { userId },
      select: { id: true },
    });
    return {
      allowed:
        Boolean(lab && ticket.printOrder?.labId === lab.id) || emailMatch,
      ticket,
    };
  }

  // ORGANIZER y demás: solo por email del solicitante
  return { allowed: emailMatch, ticket };
}

/** Where de listado propio (nunca tickets ajenos). */
export async function buildUserTicketsWhere(params: {
  userId: number;
  role: Role;
  email: string;
  printOrderId?: number | null;
}): Promise<Record<string, unknown> | null> {
  const { userId, role, email, printOrderId } = params;

  if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
    return printOrderId ? { printOrderId } : {};
  }

  let ownership: Record<string, unknown>;

  if (role === Role.CUSTOMER) {
    ownership = {
      OR: [
        { printOrder: { clientId: userId } },
        { printOrderId: null, requesterEmail: email },
      ],
    };
  } else if (role === Role.PHOTOGRAPHER || role === Role.LAB_PHOTOGRAPHER) {
    ownership = {
      OR: [
        { printOrder: { photographerId: userId } },
        { printOrderId: null, requesterEmail: email },
      ],
    };
  } else if (role === Role.LAB) {
    const lab = await prisma.lab.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!lab) return null;
    ownership = {
      OR: [
        { printOrder: { labId: lab.id } },
        { printOrderId: null, requesterEmail: email },
      ],
    };
  } else {
    ownership = { requesterEmail: email };
  }

  if (printOrderId) {
    return { AND: [ownership, { printOrderId }] };
  }
  return ownership;
}
