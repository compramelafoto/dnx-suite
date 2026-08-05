import { NextResponse } from "next/server";
import { getJudgeAuthUser } from "../../../../../../lib/judge-auth";
import {
  JuryError,
  acceptJuryTerms,
  hasAcceptedJuryTerms,
} from "../../../../../../lib/fotorank/jury";

type Ctx = { params: Promise<{ contestId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const judge = await getJudgeAuthUser();
  if (!judge) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión como jurado." } },
      { status: 401 },
    );
  }
  const { contestId } = await ctx.params;
  const accepted = await hasAcceptedJuryTerms({
    judgeAccountId: judge.id,
    contestId,
  });
  return NextResponse.json({ ok: true, accepted });
}

export async function POST(req: Request, ctx: Ctx) {
  const judge = await getJudgeAuthUser();
  if (!judge) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión como jurado." } },
      { status: 401 },
    );
  }
  const { contestId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { locale?: string };
  try {
    const result = await acceptJuryTerms({
      judgeAccountId: judge.id,
      contestId,
      locale: body.locale,
      source: "jury_terms_api",
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof JuryError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    console.error("[jury terms]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo registrar la aceptación." } },
      { status: 500 },
    );
  }
}
