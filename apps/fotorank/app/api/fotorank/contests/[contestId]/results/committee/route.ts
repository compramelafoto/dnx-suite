import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../lib/fotorank/registration";
import { recordCommitteeDecision, ResultError } from "../../../../../../lib/fotorank/results";

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
      tieGroup?: string;
      orderedSnapshotIds?: string[];
      members?: string[];
      reason?: string;
    };
    const meta = await recordCommitteeDecision({
      contestId,
      batchId: String(body.batchId ?? ""),
      actorUserId: user.id,
      tieGroup: String(body.tieGroup ?? ""),
      orderedSnapshotIds: Array.isArray(body.orderedSnapshotIds)
        ? body.orderedSnapshotIds.map(String)
        : [],
      members: Array.isArray(body.members) ? body.members.map(String) : [],
      reason: String(body.reason ?? ""),
    });
    return NextResponse.json({ ok: true, committeeDecisions: meta.committeeDecisions?.length ?? 0 });
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
    console.error("[results committee]", err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL" } }, { status: 500 });
  }
}
