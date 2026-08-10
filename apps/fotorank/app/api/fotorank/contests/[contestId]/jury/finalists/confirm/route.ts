import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../../lib/fotorank/registration";
import { confirmFinalistsForPublicVote } from "../../../../../../../lib/fotorank/jury/finalist-package";
import { JuryError } from "../../../../../../../lib/fotorank/jury/errors";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Confirma el paquete de finalistas para preparación de voto público (ETAPA 16B, §8 master rules).
 * Requiere `evaluatePrePublicVoteReadiness` en READY_FOR_PUBLIC_VOTE. Inmutable tras confirmar
 * (usar `revoke` para correcciones puntuales auditadas).
 */
export async function POST(_req: Request, ctx: Ctx) {
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

    const result = await confirmFinalistsForPublicVote({ contestId, actorUserId: user.id });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    if (err instanceof JuryError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[jury finalists confirm]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error al confirmar el paquete de finalistas." } },
      { status: 500 },
    );
  }
}
