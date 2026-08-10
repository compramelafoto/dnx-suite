import { prisma } from "@repo/db";

export async function writePublicVoteAudit(input: {
  contestId: string;
  actorUserId?: number | null;
  eventType: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  if (!contest) return;
  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: input.contestId,
      actorType: input.actorUserId ? "ADMIN" : "SYSTEM",
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payloadJson: (input.payload ?? {}) as object,
    },
  });
}
