import { prisma } from "@repo/db";
import { filterFotorankEntriesEvaluableForJudging } from "../fotorankContestEntryDomain";

export async function getJudgeAssignmentWithWindow(assignmentId: string, judgeId: string) {
  return prisma.fotorankJudgeAssignment.findFirst({
    where: { id: assignmentId, judgeAccountId: judgeId },
    select: {
      id: true,
      judgeAccountId: true,
      organizationId: true,
      contestId: true,
      categoryId: true,
      methodType: true,
      methodConfigJson: true,
      allowVoteEdit: true,
      evaluationStartsAt: true,
      evaluationEndsAt: true,
      extendedEndsAt: true,
    },
  });
}

/** Listado canónico de obras evaluables (misma regla que el panel jurado). */
export async function listEntriesForContestCategory(contestId: string, categoryId: string) {
  const rows = await prisma.fotorankContestEntry.findMany({
    where: { contestId, categoryId },
    orderBy: { createdAt: "asc" },
  });
  return filterFotorankEntriesEvaluableForJudging(rows);
}
