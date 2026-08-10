import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../../lib/fotorank/registration";
import { evaluatePrePublicVoteReadiness } from "../../../../../../../lib/fotorank/jury/pre-public-vote-readiness";
import { JuryError } from "../../../../../../../lib/fotorank/jury/errors";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Checklist previo a preparar voto público (ETAPA 16B, §9/§9.2/§10 master rules).
 * Solo lectura. NUNCA valida integración de proveedor real (Instagram) — fuera de alcance.
 */
export async function GET(_req: Request, ctx: Ctx) {
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
    const readiness = await evaluatePrePublicVoteReadiness(contestId);
    return NextResponse.json({ ok: true, readiness }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof JuryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    throw err;
  }
}
