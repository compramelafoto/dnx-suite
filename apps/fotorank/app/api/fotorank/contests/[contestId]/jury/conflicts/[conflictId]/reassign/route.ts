import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../../../lib/fotorank/registration";
import {
  JuryError,
  acceptConflictAndReassign,
} from "../../../../../../../../lib/fotorank/jury";

type Ctx = { params: Promise<{ contestId: string; conflictId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sesión requerida." } },
      { status: 401 },
    );
  }
  const { contestId, conflictId } = await ctx.params;
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

  const body = (await req.json().catch(() => ({}))) as {
    toJudgeAccountId?: string;
    reason?: string;
    idempotencyKey?: string;
  };
  if (!body.toJudgeAccountId?.trim()) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "toJudgeAccountId requerido." } },
      { status: 400 },
    );
  }

  try {
    const result = await acceptConflictAndReassign({
      contestId,
      conflictId,
      toJudgeAccountId: body.toJudgeAccountId.trim(),
      actorUserId: user.id,
      reason: body.reason ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof JuryError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    console.error("[jury conflict reassign]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo reasignar." } },
      { status: 500 },
    );
  }
}
