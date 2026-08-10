import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getJudgeAuthUser } from "../../../../../../lib/judge-auth";
import { assertJudgeContestAccess, JuryError } from "../../../../../../lib/fotorank/jury";
import { recordJuryActivityHeartbeat } from "../../../../../../lib/fotorank/jury/activity-eta";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contestId: string }> };

const MAX_DELTA_SECONDS = 600; // ignora heartbeats aislados absurdos (tab dormida, etc.)

/**
 * Heartbeat de actividad del jurado (ETAPA 16A — métrica ACTIVE_EVALUATION_TIME, §7.7 master
 * rules). No es evaluación de desempeño humano; solo alimenta la ETA de `JuryProgressPanel`.
 */
export async function POST(req: Request, ctx: Ctx) {
  const judge = await getJudgeAuthUser();
  if (!judge) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión como jurado." } },
      { status: 401 },
    );
  }
  const { contestId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { deltaSeconds?: number };
  const deltaSeconds = Math.max(0, Math.min(MAX_DELTA_SECONDS, Number(body.deltaSeconds) || 0));

  try {
    await assertJudgeContestAccess({ judgeAccountId: judge.id, contestId });

    const session = await prisma.fotorankJuryScoringSession.findFirst({
      where: { contestId, status: "OPEN", scoringEnabled: true },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    });

    await recordJuryActivityHeartbeat({
      contestId,
      jurorId: judge.id,
      scoringSessionId: session?.id ?? null,
      elapsedSeconds: deltaSeconds,
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof JuryError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.httpStatus },
      );
    }
    // Heartbeat best-effort: nunca debe romper la sesión de evaluación por un error de red/DB.
    console.error("[jury activity heartbeat]", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
