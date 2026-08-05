import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getJudgeAuthUser } from "../../../../../../../../lib/judge-auth";
import { JuryError, abstainJuryEvaluation } from "../../../../../../../../lib/fotorank/jury";

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

const REASONS = new Set([
  "CONFLICT",
  "TECHNICAL_COMPETENCE",
  "DISPLAY_ISSUE",
  "SENSITIVE_CONTENT",
  "OTHER",
]);

export async function POST(req: Request, ctx: Ctx) {
  const judge = await getJudgeAuthUser();
  if (!judge) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión como jurado." } },
      { status: 401 },
    );
  }
  const { contestId, entryId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    reason?: string;
    reasonCode?: string;
    snapshotId?: string;
  };
  if (!body.reason?.trim()) {
    return NextResponse.json(
      { error: { code: "REASON_REQUIRED", message: "Motivo obligatorio." } },
      { status: 400 },
    );
  }
  if (body.reasonCode && !REASONS.has(body.reasonCode)) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Código de abstención inválido." } },
      { status: 400 },
    );
  }

  try {
    let snapshotId = body.snapshotId;
    if (!snapshotId) {
      const snap = await prisma.fotorankJuryEntrySnapshot.findFirst({
        where: { contestId, entryId },
        orderBy: { frozenAt: "desc" },
        select: { id: true },
      });
      snapshotId = snap?.id;
    }
    if (!snapshotId) {
      return NextResponse.json(
        { error: { code: "SNAPSHOT_NOT_FOUND", message: "Snapshot no encontrado." } },
        { status: 404 },
      );
    }

    const result = await abstainJuryEvaluation({
      judgeAccountId: judge.id,
      contestId,
      snapshotId,
      reason: body.reason,
      reasonCode: body.reasonCode as
        | "CONFLICT"
        | "TECHNICAL_COMPETENCE"
        | "DISPLAY_ISSUE"
        | "SENSITIVE_CONTENT"
        | "OTHER"
        | undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof JuryError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    console.error("[jury abstain]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo registrar la abstención." } },
      { status: 500 },
    );
  }
}
