/**
 * Intents durables de notificación de jurado (Etapa 14).
 * No envían scores, ranking ni consignas no habilitadas.
 * Canales LIVE nuevos: deshabilitados (live: false).
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { enqueueTransactionalEmail } from "../notifications/outbox";

export type JuryNotificationKind =
  | "JURY_INVITATION"
  | "JURY_INVITE_REMINDER"
  | "JURY_SCORING_OPEN"
  | "JURY_EVALUATION_PENDING"
  | "JURY_SCORING_CLOSING_SOON"
  | "JURY_ASSIGNMENT_NEW"
  | "JURY_CONFLICT_REASSIGNED"
  | "JURY_SESSION_CLOSED"
  /** ETAPA 16B — finalistas calculados; no anuncia a participantes (live: false). */
  | "FINALISTS_READY"
  /** ETAPA 16B — paquete confirmado / listo para prep voto público; no publica en redes. */
  | "PUBLIC_VOTE_READY";

function newId() {
  return `jni${randomBytes(10).toString("hex")}`;
}

/**
 * Encola intent durable (auditoría) + outbox email best-effort sin PII sensible ni scores.
 */
export async function enqueueJuryNotificationIntent(input: {
  contestId: string;
  kind: JuryNotificationKind;
  toEmail?: string | null;
  toJudgeAccountId?: string | null;
  assignmentId?: string | null;
  admissionBatchId?: string | null;
  scoringSessionId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { id: true, title: true, organizationId: true },
  });
  if (!contest) return { queued: false as const, id: null };

  const id = newId();
  const sanitizedMeta = {
    ...input.metadata,
    scores: undefined,
    ranking: undefined,
    identity: undefined,
    live: false,
  };

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: contest.id,
      actorType: "SYSTEM",
      eventType: `NOTIFY_${input.kind}`,
      entityType: "JuryNotificationIntent",
      entityId: id,
      payloadJson: {
        kind: input.kind,
        toJudgeAccountId: input.toJudgeAccountId ?? null,
        toEmail: input.toEmail ? "[redacted]" : null,
        assignmentId: input.assignmentId ?? null,
        admissionBatchId: input.admissionBatchId ?? null,
        scoringSessionId: input.scoringSessionId ?? null,
        metadata: sanitizedMeta,
        live: false,
        status: "PENDING",
      },
    },
  });

  if (input.toEmail && (input.kind === "JURY_INVITATION" || input.kind === "JURY_INVITE_REMINDER")) {
    await enqueueTransactionalEmail({
      kind: input.kind === "JURY_INVITATION" ? "JURY_INVITATION" : "JURY_INVITE_REMINDER",
      toEmail: input.toEmail,
      contestId: contest.id,
      payload: {
        contestTitle: contest.title,
        kind: input.kind,
        live: false,
      },
    });
  }

  return { queued: true as const, id };
}
