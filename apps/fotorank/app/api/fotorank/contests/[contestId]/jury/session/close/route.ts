import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../../lib/fotorank/registration";
import { closeJurySession, forceCloseJurySession } from "../../../../../../../lib/fotorank/jury/jury-session-lifecycle";
import { JuryError } from "../../../../../../../lib/fotorank/jury/errors";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Cierra la sesión de jurado abierta (ETAPA 16B, envoltorio de `jury-session-lifecycle`).
 * BLOCKS si cobertura incompleta o hay POSTPONED sin resolver, salvo `force: true` + `reason`
 * (cierre forzado auditado; no calcula finalistas por sí solo).
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

    const body = (await req.json().catch(() => ({}))) as { force?: boolean; reason?: string };

    if (body.force === true) {
      const result = await forceCloseJurySession({
        contestId,
        actorUserId: user.id,
        reason: body.reason?.trim() ?? "",
      });
      return NextResponse.json({ ok: true, session: { id: result.session.id, status: result.session.status } });
    }

    const result = await closeJurySession({ contestId, actorUserId: user.id });
    return NextResponse.json({
      ok: true,
      session: { id: result.session.id, status: result.session.status },
      coverage: result.coverage,
    });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    if (err instanceof JuryError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[jury session close]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error al cerrar la sesión de jurado." } },
      { status: 500 },
    );
  }
}
