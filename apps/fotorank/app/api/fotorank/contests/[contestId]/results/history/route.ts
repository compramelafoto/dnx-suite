import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../lib/fotorank/registration";
import { listResultPublicationHistory, ResultError } from "../../../../../../lib/fotorank/results";

type Ctx = { params: Promise<{ contestId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  const batchId = new URL(req.url).searchParams.get("batchId");
  if (!batchId) {
    return NextResponse.json({ ok: false, error: { code: "BATCH_REQUIRED" } }, { status: 400 });
  }
  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
    const history = await listResultPublicationHistory({ contestId, batchId });
    return NextResponse.json({ ok: true, history });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    if (err instanceof ResultError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    console.error("[results history]", err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL" } }, { status: 500 });
  }
}
