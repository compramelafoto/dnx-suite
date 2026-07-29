/**
 * Intents durables Etapa 15 — no se envían en esta etapa.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";

export type ResultNotificationKind =
  | "RESULTS_READY_FOR_REVIEW"
  | "RESULTS_TIE_PENDING"
  | "RESULTS_BATCH_FINALIZED"
  | "RESULTS_PUBLICATION_SCHEDULED"
  | "RESULTS_PARTICIPANT_WINNER"
  | "RESULTS_PARTICIPANT_NOT_SELECTED";

function newId() {
  return `rni${randomBytes(10).toString("hex")}`;
}

export async function enqueueResultNotificationIntent(input: {
  contestId: string;
  kind: ResultNotificationKind;
  resultBatchId?: string | null;
  metadata?: Record<string, unknown>;
  /** Etapa 15: siempre false — no enviar. */
  send?: boolean;
}) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { id: true, organizationId: true },
  });
  if (!contest) return { queued: false as const, id: null };

  const id = newId();
  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: contest.id,
      actorType: "SYSTEM",
      eventType: `NOTIFY_${input.kind}`,
      entityType: "ResultNotificationIntent",
      entityId: id,
      payloadJson: {
        kind: input.kind,
        resultBatchId: input.resultBatchId ?? null,
        metadata: { ...input.metadata, scores: undefined, live: false },
        live: false,
        sent: false,
        status: "PENDING_NOT_SENT",
      },
    },
  });
  return { queued: true as const, id, sent: false as const };
}
