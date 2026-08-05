import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../../lib/auth";
import {
  assertOrganizerCanAccessContest,
  RegistrationError,
} from "../../../../../../../../lib/fotorank/registration";
import { closeScoringSession } from "../../../../../../../../lib/fotorank/jury/scoring-session-service";
import { JuryError } from "../../../../../../../../lib/fotorank/jury/errors";

type Ctx = { params: Promise<{ contestId: string; sessionId: string }> };

/**
 * Cierre de sesión de scoring (organizador).
 * Sin force por defecto. Errores de cobertura/conflictos → 409 JSON legible.
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
    const { contestId, sessionId } = await ctx.params;
    await assertOrganizerCanAccessContest(contestId, user.id);

    const body = (await req.json().catch(() => ({}))) as {
      force?: boolean;
      reason?: string;
    };

    const session = await closeScoringSession({
      contestId,
      sessionId,
      actorUserId: user.id,
      force: body.force === true,
      reason: body.reason?.trim() || null,
    });

    return NextResponse.json({ ok: true, session: { id: session.id, status: session.status } });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    if (err instanceof JuryError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    console.error("[jury scoring close]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error al cerrar sesión." } },
      { status: 500 },
    );
  }
}
