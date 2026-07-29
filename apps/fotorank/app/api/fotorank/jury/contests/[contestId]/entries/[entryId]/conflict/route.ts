import { NextResponse } from "next/server";
import { getJudgeAuthUser } from "../../../../../../../../lib/judge-auth";
import { JuryError, declareJuryConflict } from "../../../../../../../../lib/fotorank/jury";

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

const REASONS = new Set([
  "KNOW_AUTHOR",
  "PROFESSIONAL_RELATION",
  "FAMILY_RELATION",
  "PARTICIPATED_IN_PRODUCTION",
  "OTHER",
]);

export async function POST(req: Request, ctx: Ctx) {
  const judge = await getJudgeAuthUser();
  if (!judge) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión como jurado." } }, { status: 401 });
  }
  const { contestId, entryId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { reasonCode?: string; notes?: string };
  if (!body.reasonCode || !REASONS.has(body.reasonCode)) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Motivo de conflicto inválido." } }, { status: 400 });
  }
  try {
    const result = await declareJuryConflict({
      judgeAccountId: judge.id,
      contestId,
      entryId,
      reasonCode: body.reasonCode as
        | "KNOW_AUTHOR"
        | "PROFESSIONAL_RELATION"
        | "FAMILY_RELATION"
        | "PARTICIPATED_IN_PRODUCTION"
        | "OTHER",
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof JuryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[jury conflict]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "No se pudo registrar el conflicto." } }, { status: 500 });
  }
}
