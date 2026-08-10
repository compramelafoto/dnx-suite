import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../../lib/fotorank/registration";
import { getFinalistsForReview } from "../../../../../../../lib/fotorank/jury/finalists-review";
import { JuryError } from "../../../../../../../lib/fotorank/jury/errors";
import { prisma } from "@repo/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Paquete de finalistas para revisión del organizador (imagen, publicCode, score de jurado —
 * NUNCA público — estado de asset social). ETAPA 16B, §8 master rules.
 */
export async function GET(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sesión requerida." } }, { status: 401 });
  }
  const { contestId } = await ctx.params;

  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    throw err;
  }

  try {
    const url = new URL(req.url);
    let scoringSessionId = url.searchParams.get("scoringSessionId") ?? undefined;
    if (!scoringSessionId) {
      const session = await prisma.fotorankJuryScoringSession.findFirst({
        where: { contestId, status: { in: ["CLOSED", "LOCKED"] } },
        orderBy: { closedAt: "desc" },
      });
      if (!session) {
        return NextResponse.json({ ok: true, hasSession: false, packageStatus: null, positionsCount: 0, rows: [] });
      }
      scoringSessionId = session.id;
    }

    const review = await getFinalistsForReview({ contestId, scoringSessionId });
    return NextResponse.json(
      { ok: true, hasSession: true, scoringSessionId, ...review },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    if (err instanceof JuryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    throw err;
  }
}
