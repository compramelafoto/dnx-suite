/**
 * Adaptador Prisma del puerto de FotoRank.
 *
 * Como en Clickatón, los importes de la base están en unidades mínimas
 * (centavos) y se convierten a pesos acá.
 */

import type { PrismaClient } from "@prisma/client";
import type {
  DateRange,
  FotorankActivity,
  FotorankPort,
  FotorankRegistrationRow,
} from "@repo/ops-daily-report";

import { minorUnitsToArs } from "./prisma-clickaton-port";

export function createPrismaFotorankPort(client: PrismaClient): FotorankPort {
  return {
    async registrations(range: DateRange): Promise<FotorankRegistrationRow[]> {
      const rows = await client.fotorankContestRegistration.findMany({
        where: { createdAt: { gte: range.start, lt: range.end } },
        select: {
          id: true,
          contestId: true,
          status: true,
          registrationPriceSnapshot: true,
          contest: { select: { title: true } },
        },
      });

      return rows.map((row) => ({
        registrationId: row.id,
        contestId: row.contestId,
        contestTitle: row.contest?.title ?? "Concurso sin título",
        status: row.status,
        priceArs: minorUnitsToArs(row.registrationPriceSnapshot),
      }));
    },

    async activity(range: DateRange): Promise<FotorankActivity> {
      const inRange = { gte: range.start, lt: range.end };

      const [activeContests, entriesGrouped, entriesSubmitted, awaitingReview, votes, diplomas] =
        await Promise.all([
          client.fotorankContest.count({ where: { registrationEnabled: true } }),
          client.fotorankContestEntry.groupBy({
            by: ["status"],
            where: { createdAt: inRange },
            _count: { _all: true },
          }),
          client.fotorankContestEntry.count({ where: { submittedAt: inRange } }),
          client.fotorankContestEntry.count({
            where: { manualReviewStatus: "PENDING" },
          }),
          // El jurado que emitió el voto vive en la asignación, no en el voto.
          client.fotorankJudgeVote.findMany({
            where: { createdAt: inRange },
            select: { assignment: { select: { judgeAccountId: true } } },
          }),
          client.fotorankDiplomaIssued.count({ where: { createdAt: inRange } }),
        ]);

      const entriesByStatus: Record<string, number> = {};
      for (const group of entriesGrouped) {
        entriesByStatus[group.status] = group._count._all;
      }

      const activeJudges = new Set(votes.map((vote) => vote.assignment.judgeAccountId)).size;

      return {
        activeContests,
        entriesSubmitted,
        entriesByStatus,
        entriesAwaitingReview: awaitingReview,
        juryVotes: votes.length,
        activeJudges,
        diplomasIssued: diplomas,
      };
    },
  };
}
