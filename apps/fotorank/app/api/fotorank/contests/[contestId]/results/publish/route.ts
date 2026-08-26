import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../lib/fotorank/registration";
import { publishResultBatch, ResultError } from "../../../../../../lib/fotorank/results";

type Ctx = { params: Promise<{ contestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
    const body = (await req.json()) as {
      batchId?: string;
      expectedHash?: string;
      confirmationPhrase?: string;
      idempotencyKey?: string;
    };
    const result = await publishResultBatch({
      contestId,
      batchId: String(body.batchId ?? ""),
      actorUserId: user.id,
      expectedHash: String(body.expectedHash ?? ""),
      confirmationPhrase: String(body.confirmationPhrase ?? ""),
      idempotencyKey: String(body.idempotencyKey ?? `pub-${Date.now()}`),
      stagingTest: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    if (err instanceof ResultError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[results publish]", err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL" } }, { status: 500 });
  }
}
