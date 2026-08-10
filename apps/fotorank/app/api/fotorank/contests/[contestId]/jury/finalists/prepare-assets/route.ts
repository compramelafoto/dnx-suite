import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../../lib/fotorank/registration";
import { prepareFinalistPublicAssets } from "../../../../../../../lib/fotorank/jury/public-asset-prep";
import { JuryError } from "../../../../../../../lib/fotorank/jury/errors";
import { prisma } from "@repo/db";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Prepara (placeholder, no publica) los derivados sociales de finalistas para poder llegar a
 * READY_FOR_PUBLIC_VOTE (ETAPA 16B). NO sube nada a redes ni activa el voto público.
 */
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

    const body = (await req.json().catch(() => ({}))) as { scoringSessionId?: string };

    let scoringSessionId = body.scoringSessionId;
    if (!scoringSessionId) {
      const session = await prisma.fotorankJuryScoringSession.findFirst({
        where: { contestId, status: { in: ["CLOSED", "LOCKED"] } },
        orderBy: { closedAt: "desc" },
      });
      if (!session) {
        return NextResponse.json(
          { ok: false, error: { code: "SESSION_NOT_FOUND", message: "No hay sesión de jurado CLOSED/LOCKED." } },
          { status: 404 },
        );
      }
      scoringSessionId = session.id;
    }

    const result = await prepareFinalistPublicAssets({ contestId, scoringSessionId, actorUserId: user.id });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    if (err instanceof JuryError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[jury finalists prepare-assets]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error al preparar los assets de finalistas." } },
      { status: 500 },
    );
  }
}
