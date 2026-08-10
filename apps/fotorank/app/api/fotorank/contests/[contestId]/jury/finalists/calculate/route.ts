import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../../lib/fotorank/registration";
import { selectFinalistsPerPrompt } from "../../../../../../../lib/fotorank/jury/finalists-engine";
import { JuryError } from "../../../../../../../lib/fotorank/jury/errors";
import { prisma } from "@repo/db";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Calcula/selecciona finalistas por consigna (ETAPA 16B, §8 master rules).
 * Requiere una sesión CLOSED/LOCKED. Idempotente sobre snapshots no confirmados.
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

    const result = await selectFinalistsPerPrompt({ contestId, scoringSessionId, actorUserId: user.id });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    if (err instanceof JuryError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[jury finalists calculate]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error al calcular finalistas." } },
      { status: 500 },
    );
  }
}
