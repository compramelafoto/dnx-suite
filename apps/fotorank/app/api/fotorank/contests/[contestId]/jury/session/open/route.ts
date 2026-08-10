import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../../lib/fotorank/registration";
import { openJurySession } from "../../../../../../../lib/fotorank/jury/jury-session-lifecycle";
import { JuryError } from "../../../../../../../lib/fotorank/jury/errors";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Abre la sesión de jurado (ETAPA 16B). Requiere checklist READY_FOR_JURY (§4/§6/§7 master rules).
 * NUNCA activa jurado del concurso comercial excluido (ver `commercial-contest-guard`).
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

    const body = (await req.json().catch(() => ({}))) as { confirmationPhrase?: string };

    const result = await openJurySession({
      contestId,
      actorUserId: user.id,
      confirmationPhrase: body.confirmationPhrase?.trim() || null,
    });

    return NextResponse.json({
      ok: true,
      session: { id: result.session.id, status: result.session.status },
      readiness: result.readiness,
    });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    if (err instanceof JuryError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[jury session open]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error al abrir la sesión de jurado." } },
      { status: 500 },
    );
  }
}
