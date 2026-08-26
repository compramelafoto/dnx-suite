import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../lib/fotorank/registration";
import { evaluateResultPublicationReadiness } from "../../../../../../lib/fotorank/results";

type Ctx = { params: Promise<{ contestId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ ok: false, error: { code: err.code } }, { status: err.httpStatus });
    }
    throw err;
  }
  const url = new URL(req.url);
  const batchId = url.searchParams.get("batchId");
  const readiness = await evaluateResultPublicationReadiness({ contestId, batchId });
  return NextResponse.json({ ok: true, readiness });
}
