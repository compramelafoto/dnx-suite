import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../lib/fotorank/registration";
import { getOrganizerProvisionalRanking } from "../../../../../../lib/fotorank/jury/provisional-ranking";
import { JuryError } from "../../../../../../lib/fotorank/jury/errors";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Ranking provisorio del jurado (ETAPA 16A — organizador, §7.8 master rules).
 * "Puede ver ranking provisional con banner RESULTADO PROVISORIO — EVALUACIÓN INCOMPLETA.
 * No edita notas." NO reemplaza el ranking privado oficial de Etapa 15.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sesión requerida." } },
      { status: 401 },
    );
  }
  const { contestId } = await ctx.params;

  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    throw err;
  }

  try {
    const ranking = await getOrganizerProvisionalRanking({ contestId });
    return NextResponse.json(
      { ok: true, hasSession: true, ...ranking },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    if (err instanceof JuryError && err.code === "SESSION_NOT_FOUND") {
      return NextResponse.json({ ok: true, hasSession: false, ranking: null });
    }
    if (err instanceof JuryError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    throw err;
  }
}
