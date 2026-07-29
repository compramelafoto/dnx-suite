import { NextResponse } from "next/server";
import { getJudgeAuthUser } from "../../../../../../lib/judge-auth";
import { JuryError, listAnonymousEntriesForJuror } from "../../../../../../lib/fotorank/jury";

type Ctx = { params: Promise<{ contestId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const judge = await getJudgeAuthUser();
  if (!judge) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión como jurado." } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  try {
    const data = await listAnonymousEntriesForJuror({
      judgeAccountId: judge.id,
      contestId,
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    if (err instanceof JuryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[jury entries]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "Error al listar obras." } }, { status: 500 });
  }
}
