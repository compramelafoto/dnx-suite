import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import {
  assertOrganizerCanAccessContest,
  RegistrationError,
} from "../../../../../../lib/fotorank/registration";
import {
  createPublicVoteRoundsFromFinalists,
  evaluatePublicVotePhaseReadiness,
} from "../../../../../../lib/fotorank/public-vote";
import { PublicVoteError } from "../../../../../../lib/fotorank/public-vote/errors";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contestId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sesión requerida." } },
      { status: 401 },
    );
  }
  try {
    const { contestId } = await ctx.params;
    await assertOrganizerCanAccessContest(contestId, user.id);
    const readiness = await evaluatePublicVotePhaseReadiness(contestId);
    return NextResponse.json({ ok: true, readiness });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    if (err instanceof PublicVoteError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    console.error("[public-vote rounds GET]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error de readiness." } },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Sesión requerida." } },
      { status: 401 },
    );
  }
  try {
    const { contestId } = await ctx.params;
    await assertOrganizerCanAccessContest(contestId, user.id);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await createPublicVoteRoundsFromFinalists({
      contestId,
      actorUserId: user.id,
      startsAt: body.startsAt ? new Date(String(body.startsAt)) : undefined,
      endsAt: body.endsAt ? new Date(String(body.endsAt)) : undefined,
      provider: "TEST_PROVIDER",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    if (err instanceof PublicVoteError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    console.error("[public-vote rounds POST]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error al crear rondas." } },
      { status: 500 },
    );
  }
}
