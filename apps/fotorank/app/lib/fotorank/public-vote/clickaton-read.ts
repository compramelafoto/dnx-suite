/**
 * Integración de lectura para Clickatón (FotoRank = SoT).
 * No publica resultados comerciales; solo consulta estado.
 */
import { prisma } from "@repo/db";
import { getPublicVoteMonitor, buildPublicSafeRoundPayload } from "./monitor";
import { COMMERCIAL_CONTEST_ID_BLOCKED } from "../jury/commercial-contest-guard";

export async function getClickatonPublicVotePhaseView(input: {
  contestId: string;
  /** Si true, permite leer comercial solo en modo status (sin mutar). */
  allowCommercialRead?: boolean;
}) {
  if (
    input.contestId === COMMERCIAL_CONTEST_ID_BLOCKED &&
    !input.allowCommercialRead
  ) {
    return {
      contestId: input.contestId,
      commercial: true,
      publicVoteEnabled: false,
      phase: "OFF" as const,
      units: [],
      published: false,
    };
  }

  const config = await prisma.fotorankCompetitionJuryConfig.findUnique({
    where: { contestId: input.contestId },
  });
  const monitor = await getPublicVoteMonitor(input.contestId);
  const rounds = await prisma.fotorankPublicVoteRound.findMany({
    where: { contestId: input.contestId, roundType: "NORMAL" },
    include: {
      candidates: { where: { active: true } },
      finalSnapshots: true,
    },
    orderBy: { unitKey: "asc" },
  });

  return {
    contestId: input.contestId,
    commercial: input.contestId === COMMERCIAL_CONTEST_ID_BLOCKED,
    publicVoteEnabled: config?.publicVoteEnabled ?? false,
    publicVoteMode: config?.publicVoteMode ?? "DISABLED",
    publicVoteStatus: config?.publicVoteStatus ?? "NOT_CONFIGURED",
    phase: monitor.summary.phaseFinalized
      ? ("FINALIZED" as const)
      : monitor.summary.open > 0
        ? ("OPEN" as const)
        : rounds.length > 0
          ? ("PREPARED" as const)
          : ("OFF" as const),
    summary: monitor.summary,
    units: rounds.map((r) => ({
      ...buildPublicSafeRoundPayload(r),
      finalists: r.candidates.map((c) => c.publicCode),
      definitivePositions:
        r.status === "FINALIZED"
          ? r.finalSnapshots
              .filter((s) => s.finalPosition != null)
              .map((s) => ({
                publicCode: s.publicCode,
                position: s.finalPosition!,
                finalMetricValue: s.finalMetricValue,
              }))
          : [],
      publicationStatus: r.resultsPublicationStatus,
    })),
    published: false,
  };
}
