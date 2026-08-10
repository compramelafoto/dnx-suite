import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../lib/fotorank/registration";
import { computeJuryCapacity } from "../../../../../../lib/fotorank/jury/capacity-calculator";
import { getOrCreateCompetitionJuryConfig } from "../../../../../../lib/fotorank/jury/competition-jury-config";
import { JuryError } from "../../../../../../lib/fotorank/jury/errors";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Calculadora de capacidad de jurado (ETAPA 16A — organizador, solo planificación).
 * No bloquea publicación ni ninguna acción; es un panel informativo.
 * Usa `FotorankCompetitionJuryConfig` (§6 master rules) como fuente de verdad de umbrales.
 */
export async function GET(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sesión requerida." } },
      { status: 401 },
    );
  }
  const { contestId } = await ctx.params;

  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    throw err;
  }

  const url = new URL(req.url);
  const estimatedParticipantsRaw = url.searchParams.get("estimatedParticipants");

  try {
    const [confirmedEntries, config, acceptedAssignments] = await Promise.all([
      prisma.fotorankContestEntry.count({
        where: { contestId, status: "CONFIRMED", withdrawnAt: null },
      }),
      getOrCreateCompetitionJuryConfig(contestId),
      prisma.fotorankJudgeAssignment.findMany({
        where: {
          contestId,
          assignmentStatus: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "EXTENDED"] },
        },
        select: { judgeAccountId: true },
        distinct: ["judgeAccountId"],
      }),
    ]);

    const estimatedEntries = estimatedParticipantsRaw
      ? Number(estimatedParticipantsRaw) || 0
      : confirmedEntries;

    const result = computeJuryCapacity({
      estimatedEntries,
      requiredEvaluationsPerEntry: config.requiredEvaluationsPerEntry,
      recommendedMaxEntriesPerJudge: config.recommendedMaxEntriesPerJudge,
      yellowLoadThreshold: config.yellowLoadThreshold,
      redLoadThreshold: config.redLoadThreshold,
      acceptedJudges: acceptedAssignments.length,
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
        confirmedEntries,
        usedFallbackEstimate: !estimatedParticipantsRaw,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof JuryError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.httpStatus },
      );
    }
    throw error;
  }
}
