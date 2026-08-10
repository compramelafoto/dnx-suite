import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import {
  assertOrganizerCanAccessContest,
  RegistrationError,
} from "../../../../../../lib/fotorank/registration";
import { getPublicVoteMonitor } from "../../../../../../lib/fotorank/public-vote";
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
    const monitor = await getPublicVoteMonitor(contestId);
    return NextResponse.json(
      { ok: true, monitor },
      { headers: { "Cache-Control": "private, no-store" } },
    );
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
    console.error("[public-vote monitor]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error al cargar monitor." } },
      { status: 500 },
    );
  }
}
