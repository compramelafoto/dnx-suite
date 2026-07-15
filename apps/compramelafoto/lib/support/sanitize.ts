/**
 * Sanitización y contratos públicos de soporte (panel usuario).
 */

export function isTicketClosedForUserReply(status: string): boolean {
  return status === "CLOSED" || status === "RESOLVED";
}

export const SUPPORT_MESSAGE_MAX_LENGTH = 5000;
export const SUPPORT_DESCRIPTION_MAX_LENGTH = 8000;
export const SUPPORT_REASON_MAX_LENGTH = 80;

const ALLOWED_REASONS = new Set([
  "PAYMENT_FAILED",
  "ORDER_STATUS",
  "LAB_ISSUE",
  "COMMISSION_ISSUE",
  "TECHNICAL_ISSUE",
  "OTHER",
]);

/** Texto plano: quita tags HTML y control chars. */
export function sanitizeSupportText(raw: string, maxLen: number): string {
  return String(raw ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, maxLen);
}

export function normalizeRequesterRole(
  requested: unknown,
  sessionRole: string | null | undefined
): string {
  let role = String(requested || sessionRole || "OTHER").toUpperCase();
  if (role === "CLIENT") role = "CUSTOMER";
  const allowed = new Set([
    "CUSTOMER",
    "PHOTOGRAPHER",
    "LAB",
    "LAB_PHOTOGRAPHER",
    "ORGANIZER",
    "OTHER",
  ]);
  if (!allowed.has(role)) return "OTHER";
  return role;
}

export type CreateTicketInput = {
  reason: string;
  description: string;
  printOrderId: number | null;
  requesterName: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requesterRole: string;
};

export function sanitizeCreateTicketBody(
  body: Record<string, unknown>,
  session: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  }
): { ok: true; data: CreateTicketInput } | { ok: false; error: string } {
  const reason = sanitizeSupportText(String(body.reason ?? ""), SUPPORT_REASON_MAX_LENGTH);
  const description = sanitizeSupportText(
    String(body.description ?? ""),
    SUPPORT_DESCRIPTION_MAX_LENGTH
  );

  if (!reason || !description) {
    return { ok: false, error: "El motivo y la descripción son requeridos" };
  }
  if (!ALLOWED_REASONS.has(reason) && reason.length < 2) {
    return { ok: false, error: "Motivo inválido" };
  }

  let printOrderId: number | null = null;
  if (body.printOrderId != null && body.printOrderId !== "") {
    const n = Number(body.printOrderId);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: "Pedido inválido" };
    }
    printOrderId = n;
  }

  const requesterName = sanitizeSupportText(
    String(body.requesterName ?? session.name ?? ""),
    120
  ) || null;
  const requesterEmail = sanitizeSupportText(
    String(body.requesterEmail ?? session.email ?? ""),
    200
  ).toLowerCase() || null;
  const requesterPhone = sanitizeSupportText(
    String(body.requesterPhone ?? ""),
    40
  ) || null;

  return {
    ok: true,
    data: {
      reason,
      description,
      printOrderId,
      requesterName,
      requesterEmail,
      requesterPhone,
      requesterRole: normalizeRequesterRole(body.requesterRole, session.role),
    },
  };
}

export function sanitizeMessageBody(
  body: Record<string, unknown>
): { ok: true; message: string } | { ok: false; error: string } {
  const message = sanitizeSupportText(
    String(body.message ?? ""),
    SUPPORT_MESSAGE_MAX_LENGTH
  );
  if (!message) {
    return { ok: false, error: "El mensaje es requerido" };
  }
  if (message.length < 1) {
    return { ok: false, error: "El mensaje es requerido" };
  }
  return { ok: true, message };
}

/** Campos públicos de mensaje (sin notas internas / sin PII extra). */
export function toPublicSupportMessage(msg: {
  id: number;
  createdAt: Date;
  message: string;
  isInternal?: boolean;
  authorId: number | null;
  authorName: string | null;
  authorEmail: string | null;
  author?: { name: string | null; email: string | null; role: string } | null;
}) {
  return {
    id: msg.id,
    createdAt: msg.createdAt,
    message: msg.message,
    isInternal: false,
    authorId: msg.authorId,
    authorName: msg.authorName || msg.author?.name || null,
    authorEmail: msg.authorEmail || msg.author?.email || null,
    author: msg.author
      ? {
          name: msg.author.name,
          role: msg.author.role,
        }
      : undefined,
  };
}

export function toPublicSupportTicket(ticket: {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  reason: string;
  description: string;
  status: string;
  printOrderId: number | null;
  requesterName: string | null;
  requesterEmail: string | null;
  requesterRole: string | null;
  printOrder?: {
    id: number;
    customerName?: string | null;
    customerEmail?: string | null;
  } | null;
  messages?: Array<{
    id: number;
    createdAt: Date;
    message: string;
    isInternal?: boolean;
    authorId: number | null;
    authorName: string | null;
    authorEmail: string | null;
    author?: { name: string | null; email: string | null; role: string } | null;
  }>;
}) {
  return {
    id: ticket.id,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    reason: ticket.reason,
    description: ticket.description,
    status: ticket.status,
    printOrderId: ticket.printOrderId,
    requesterName: ticket.requesterName,
    requesterEmail: ticket.requesterEmail,
    requesterRole: ticket.requesterRole,
    printOrder: ticket.printOrder
      ? {
          id: ticket.printOrder.id,
          customerName: ticket.printOrder.customerName ?? null,
        }
      : null,
    messages: (ticket.messages || []).map(toPublicSupportMessage),
  };
}

export const SUPPORT_TICKET_FORBIDDEN_FIELDS = [
  "internalNotes",
  "resolutionNote",
  "assignedToId",
  "attachments",
  "lastReplyEmailSentAt",
] as const;
