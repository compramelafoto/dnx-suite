import { NextResponse } from "next/server";
import { getJudgeAuthUser } from "../../../../../../lib/judge-auth";
import { JuryError } from "../../../../../../lib/fotorank/jury";
import {
  postponeJuryEvaluation,
  upsertJuryEvaluation,
} from "../../../../../../lib/fotorank/jury/evaluation-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const judge = await getJudgeAuthUser();
  if (!judge) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión como jurado." } },
      { status: 401 },
    );
  }
  const { contestId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    snapshotId?: string;
    scores?: Array<{ key: string; score: number; comment?: string }>;
    privateComment?: string;
    submit?: boolean;
    postpone?: boolean;
    expectedVersion?: number;
    idempotencyKey?: string;
  };

  if (!body.snapshotId) {
    return NextResponse.json({ error: { code: "SNAPSHOT_REQUIRED", message: "snapshotId requerido" } }, { status: 400 });
  }

  try {
    // "Revisar después" (ETAPA 16A): pospone sin invalidar scores/comentario ya ingresados.
    if (body.postpone) {
      const result = await postponeJuryEvaluation({
        judgeAccountId: judge.id,
        contestId,
        snapshotId: body.snapshotId,
        expectedVersion: body.expectedVersion,
      });
      return NextResponse.json(
        {
          ok: true,
          evaluationId: result.evaluation.id,
          status: result.evaluation.status,
          expectedVersion: result.evaluation.expectedVersion,
          idempotent: result.idempotent,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const result = await upsertJuryEvaluation({
      judgeAccountId: judge.id,
      contestId,
      snapshotId: body.snapshotId,
      scores: body.scores ?? [],
      privateComment: body.privateComment ?? null,
      submit: Boolean(body.submit),
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey ?? null,
    });
    return NextResponse.json(
      {
        ok: true,
        evaluationId: result.evaluation.id,
        status: result.evaluation.status,
        expectedVersion: result.evaluation.expectedVersion,
        totalScore: result.evaluation.totalScore,
        normalizedScore: result.evaluation.normalizedScore,
        idempotent: result.idempotent,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof JuryError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message }, message: error.message },
        { status: error.httpStatus },
      );
    }
    throw error;
  }
}
