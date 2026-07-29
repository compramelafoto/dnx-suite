import { prisma } from "@repo/db";

/**
 * Contadores operativos (una query groupada donde sea posible).
 *
 * Definiciones:
 * - registrationCount: inscripciones no CANCELLED/DISQUALIFIED
 * - confirmedRegistrationCount: status CONFIRMED
 * - entriesUploadedCount: obras con status != DRAFT y no WITHDRAWN
 * - entriesConfirmedCount: obras CONFIRMED y no retiradas
 * - entriesPendingReviewCount: technicalSummaryStatus REQUIRES_REVIEW
 * - entriesRejectedCount: status REJECTED o TECHNICALLY_REJECTED
 * - juryInvitedCount: invitaciones SENT|OPENED|ACCEPTED
 * - juryAcceptedCount: assignments ACCEPTED|IN_PROGRESS|COMPLETED|EXTENDED (distinct judge)
 */
export type ContestOperationalMetrics = {
  registrationCount: number;
  confirmedRegistrationCount: number;
  entriesUploadedCount: number;
  entriesConfirmedCount: number;
  entriesPendingReviewCount: number;
  entriesRejectedCount: number;
  juryInvitedCount: number;
  juryAcceptedCount: number;
};

export async function getContestOperationalMetrics(contestId: string): Promise<ContestOperationalMetrics> {
  const [
    registrationCount,
    confirmedRegistrationCount,
    entriesUploadedCount,
    entriesConfirmedCount,
    entriesPendingReviewCount,
    entriesRejectedCount,
    juryInvitedCount,
    acceptedAssignments,
  ] = await Promise.all([
    prisma.fotorankContestRegistration.count({
      where: {
        contestId,
        status: { notIn: ["CANCELLED", "DISQUALIFIED"] },
      },
    }),
    prisma.fotorankContestRegistration.count({
      where: { contestId, status: "CONFIRMED" },
    }),
    prisma.fotorankContestEntry.count({
      where: {
        contestId,
        status: { notIn: ["DRAFT", "WITHDRAWN"] },
        withdrawnAt: null,
      },
    }),
    prisma.fotorankContestEntry.count({
      where: { contestId, status: "CONFIRMED", withdrawnAt: null },
    }),
    prisma.fotorankContestEntry.count({
      where: { contestId, technicalSummaryStatus: "REQUIRES_REVIEW", withdrawnAt: null },
    }),
    prisma.fotorankContestEntry.count({
      where: {
        contestId,
        OR: [{ status: "REJECTED" }, { technicalSummaryStatus: "TECHNICALLY_REJECTED" }],
      },
    }),
    prisma.fotorankJudgeInvitation.count({
      where: {
        contestId,
        invitationStatus: { in: ["SENT", "OPENED", "ACCEPTED"] },
      },
    }),
    prisma.fotorankJudgeAssignment.findMany({
      where: {
        contestId,
        assignmentStatus: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "EXTENDED"] },
      },
      select: { judgeAccountId: true },
      distinct: ["judgeAccountId"],
    }),
  ]);

  return {
    registrationCount,
    confirmedRegistrationCount,
    entriesUploadedCount,
    entriesConfirmedCount,
    entriesPendingReviewCount,
    entriesRejectedCount,
    juryInvitedCount,
    juryAcceptedCount: acceptedAssignments.length,
  };
}

/** Batch de confirmedRegistrationCount + entriesConfirmedCount para Public API (evita N+1). */
export async function getPublicCountsByContestIds(contestIds: string[]): Promise<
  Map<string, { confirmedRegistrationCount: number; confirmedEntryCount: number }>
> {
  const map = new Map<string, { confirmedRegistrationCount: number; confirmedEntryCount: number }>();
  if (contestIds.length === 0) return map;

  const [regs, entries] = await Promise.all([
    prisma.fotorankContestRegistration.groupBy({
      by: ["contestId"],
      where: { contestId: { in: contestIds }, status: "CONFIRMED" },
      _count: { _all: true },
    }),
    prisma.fotorankContestEntry.groupBy({
      by: ["contestId"],
      where: { contestId: { in: contestIds }, status: "CONFIRMED", withdrawnAt: null },
      _count: { _all: true },
    }),
  ]);

  for (const id of contestIds) {
    map.set(id, { confirmedRegistrationCount: 0, confirmedEntryCount: 0 });
  }
  for (const r of regs) {
    const prev = map.get(r.contestId) ?? { confirmedRegistrationCount: 0, confirmedEntryCount: 0 };
    prev.confirmedRegistrationCount = r._count._all;
    map.set(r.contestId, prev);
  }
  for (const e of entries) {
    const prev = map.get(e.contestId) ?? { confirmedRegistrationCount: 0, confirmedEntryCount: 0 };
    prev.confirmedEntryCount = e._count._all;
    map.set(e.contestId, prev);
  }
  return map;
}
