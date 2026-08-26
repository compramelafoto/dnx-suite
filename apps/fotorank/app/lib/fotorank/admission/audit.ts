import { prisma } from "@repo/db";
import { ADMISSION_ENGINE_VERSION, ADMISSION_RULES_VERSION } from "./types";

/**
 * Auditoría vía FotorankJudgeAuditEvent (infra existente).
 * Nunca registrar GPS exacto, ARGRA completo, secretos ni URLs firmadas.
 */
export async function writeAdmissionAudit(input: {
  contestId: string;
  actorUserId: number;
  entryId: string;
  action: string;
  previousStatus?: string | null;
  nextStatus?: string | null;
  reasonCode?: string | null;
  note?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  if (!contest) return;

  const safeMeta = { ...(input.metadata ?? {}) };
  for (const banned of [
    "gpsLatitude",
    "gpsLongitude",
    "argraMembershipNumber",
    "signedUrl",
    "buffer",
    "secret",
  ]) {
    delete safeMeta[banned];
  }

  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: input.contestId,
      actorType: "ADMIN",
      actorUserId: input.actorUserId,
      eventType: `ADMISSION_${input.action}`,
      entityType: "FotorankContestEntry",
      entityId: input.entryId,
      payloadJson: {
        previousStatus: input.previousStatus ?? null,
        nextStatus: input.nextStatus ?? null,
        reasonCode: input.reasonCode ?? null,
        note: input.note ? String(input.note).slice(0, 500) : null,
        requestId: input.requestId ?? null,
        engineVersion: ADMISSION_ENGINE_VERSION,
        rulesVersion: ADMISSION_RULES_VERSION,
        ...safeMeta,
      },
    },
  });
}
