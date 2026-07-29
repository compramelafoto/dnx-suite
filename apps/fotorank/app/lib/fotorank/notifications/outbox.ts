/**
 * Outbox de emails transaccionales mínimos (P0-08).
 * Si no hay provider real, persiste eventos en memoria/DB para reintento.
 * La inscripción NO debe fallar si el email falla.
 */
import { prisma } from "@repo/db";

export type TransactionalEmailKind =
  | "REGISTRATION_CONFIRMED"
  | "PHOTO_RECEIVED"
  | "ENTRY_CONFIRMED"
  | "REPLACEMENT_REQUESTED"
  | "JURY_INVITATION"
  | "JURY_INVITE_REMINDER"
  | "JURY_SCORING_OPEN"
  | "JURY_SCORING_CLOSING_SOON"
  | "JURY_ASSIGNMENT_NEW"
  | "JURY_SESSION_CLOSED";

export type OutboxMessage = {
  kind: TransactionalEmailKind;
  toUserId?: number;
  toEmail?: string;
  contestId?: string;
  entryId?: string;
  registrationId?: string;
  payload: Record<string, unknown>;
};

type OutboxStatus = "QUEUED" | "FAILED" | "SENT";

const memoryOutbox: Array<OutboxMessage & { id: string; createdAt: string; status: OutboxStatus }> = [];

export function getMemoryOutboxSnapshot() {
  return [...memoryOutbox];
}

export async function enqueueTransactionalEmail(msg: OutboxMessage): Promise<{ queued: boolean; id: string }> {
  const id = `mail_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const row = {
    ...msg,
    id,
    createdAt: new Date().toISOString(),
    status: "QUEUED" as OutboxStatus,
    payload: {
      ...msg.payload,
      // nunca guardar secrets
    },
  };

  memoryOutbox.push(row);

  // Best-effort audit (solo si hay org real; no inventar FK).
  if (msg.contestId) {
    try {
      const contest = await prisma.fotorankContest.findUnique({
        where: { id: msg.contestId },
        select: { organizationId: true },
      });
      if (contest?.organizationId) {
        void prisma.fotorankJudgeAuditEvent
          .create({
            data: {
              organizationId: contest.organizationId,
              contestId: msg.contestId,
              actorType: "SYSTEM",
              eventType: `EMAIL_${msg.kind}`,
              entityType: msg.entryId ? "FotorankContestEntry" : "EmailOutbox",
              entityId: msg.entryId ?? msg.registrationId ?? id,
              payloadJson: {
                outboxId: id,
                kind: msg.kind,
                toUserId: msg.toUserId ?? null,
                status: "QUEUED",
              },
            },
          })
          .catch(() => null);
      }
    } catch {
      // no bloquear inscripción
    }
  }

  // Provider real ausente → marcar como queued (mock).
  if (!process.env.RESEND_API_KEY && !process.env.FOTORANK_SMTP_URL) {
    return { queued: true, id };
  }

  // Hook futuro: enviar y marcar SENT/FAILED sin lanzar al caller.
  try {
    // placeholder — no enviar en P0-08 sin provider cableado
    return { queued: true, id };
  } catch {
    row.status = "FAILED";
    return { queued: true, id };
  }
}

export const TRANSACTIONAL_EMAIL_TEMPLATES: Record<
  TransactionalEmailKind,
  { subject: string; requiredVars: string[] }
> = {
  REGISTRATION_CONFIRMED: {
    subject: "Inscripción confirmada — {{contestTitle}}",
    requiredVars: ["contestTitle", "registrationNumber"],
  },
  PHOTO_RECEIVED: {
    subject: "Fotografía recibida — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
  ENTRY_CONFIRMED: {
    subject: "Obra confirmada — {{anonymousCode}}",
    requiredVars: ["contestTitle", "anonymousCode"],
  },
  REPLACEMENT_REQUESTED: {
    subject: "Solicitud de reemplazo — {{contestTitle}}",
    requiredVars: ["contestTitle", "reason"],
  },
  JURY_INVITATION: {
    subject: "Invitación a jurado — {{contestTitle}}",
    requiredVars: ["contestTitle", "inviteUrl"],
  },
  JURY_INVITE_REMINDER: {
    subject: "Recordatorio: invitación a jurado — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
  JURY_SCORING_OPEN: {
    subject: "Evaluación abierta — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
  JURY_SCORING_CLOSING_SOON: {
    subject: "Cierre próximo de evaluación — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
  JURY_ASSIGNMENT_NEW: {
    subject: "Nueva asignación de jurado — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
  JURY_SESSION_CLOSED: {
    subject: "Sesión de evaluación cerrada — {{contestTitle}}",
    requiredVars: ["contestTitle"],
  },
};
