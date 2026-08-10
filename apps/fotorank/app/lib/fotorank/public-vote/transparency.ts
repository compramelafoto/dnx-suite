/**
 * Objeto de transparencia pública futura (NO publicar en 17A).
 */
import { prisma } from "@repo/db";

export async function buildTransparencyObject(roundId: string) {
  const round = await prisma.fotorankPublicVoteRound.findUnique({
    where: { id: roundId },
    include: {
      finalSnapshots: { orderBy: { finalPosition: "asc" } },
      childRounds: {
        include: { finalSnapshots: true },
        orderBy: { roundNumber: "asc" },
      },
    },
  });
  if (!round) return null;

  return {
    unitKey: round.unitKey,
    window: {
      startsAt: round.startsAt.toISOString(),
      endsAt: round.endsAt.toISOString(),
      timezone: round.timezone,
    },
    metric: round.metric,
    round: {
      number: round.roundNumber,
      type: round.roundType,
      status: round.status,
    },
    candidates: round.finalSnapshots.map((s) => ({
      publicCode: s.publicCode,
      finalMetricValue: s.finalMetricValue,
      finalPosition: s.finalPosition,
    })),
    tiebreaks: round.childRounds.map((c) => ({
      roundNumber: c.roundNumber,
      status: c.status,
      candidates: c.finalSnapshots.map((s) => ({
        publicCode: s.publicCode,
        finalMetricValue: s.finalMetricValue,
        finalPosition: s.finalPosition,
      })),
    })),
    // Explicitamente sin PII / jury / storage keys
    published: false,
  };
}
