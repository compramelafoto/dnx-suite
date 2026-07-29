import { NextResponse } from "next/server";
import { getJudgeAuthUser } from "../../../../../../../lib/judge-auth";
import { JuryError, getAnonymousEntryDetailForJuror } from "../../../../../../../lib/fotorank/jury";

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const judge = await getJudgeAuthUser();
  if (!judge) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión como jurado." } }, { status: 401 });
  }
  const { contestId, entryId } = await ctx.params;
  try {
    const entry = await getAnonymousEntryDetailForJuror({
      judgeAccountId: judge.id,
      contestId,
      entryId,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    if (err instanceof JuryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[jury entry detail]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "Error al cargar la obra." } }, { status: 500 });
  }
}
