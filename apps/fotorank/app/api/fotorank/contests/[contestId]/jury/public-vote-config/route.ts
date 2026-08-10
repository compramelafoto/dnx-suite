import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../lib/fotorank/registration";
import { getPublicVoteConfig, upsertPublicVoteConfig } from "../../../../../../lib/fotorank/jury/public-vote-config";
import { JuryError } from "../../../../../../lib/fotorank/jury/errors";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Configuración de preparación de voto público (ETAPA 16B, §9–§10 master rules).
 * Reutiliza `FotorankCompetitionJuryConfig`. NUNCA activa automatización comercial/redes.
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

  const config = await getPublicVoteConfig(contestId);
  return NextResponse.json({ ok: true, config }, { headers: { "Cache-Control": "private, no-store" } });
}

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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const config = {
      publicVoteMode: body.publicVoteMode as "DISABLED" | "JURY_ONLY" | "JURY_THEN_PUBLIC" | undefined,
      publicVoteEnabled: typeof body.publicVoteEnabled === "boolean" ? body.publicVoteEnabled : undefined,
      publicVoteUnit: body.publicVoteUnit as "PROMPT" | "CATEGORY" | "ENTRY" | "ROUND" | undefined,
      publicVoteMetric: typeof body.publicVoteMetric === "string" ? body.publicVoteMetric : undefined,
      publicVoteDurationMinutes:
        typeof body.publicVoteDurationMinutes === "number" ? body.publicVoteDurationMinutes : undefined,
      publicVoteStartsAt: body.publicVoteStartsAt ? new Date(body.publicVoteStartsAt as string) : undefined,
      publicVoteEndsAt: body.publicVoteEndsAt ? new Date(body.publicVoteEndsAt as string) : undefined,
      publicVoteProvider: body.publicVoteProvider as "NONE" | "INSTAGRAM_FUTURE" | undefined,
      publicVoteStatus: typeof body.publicVoteStatus === "string" ? body.publicVoteStatus : undefined,
      publicTieBreakMode: typeof body.publicTieBreakMode === "string" ? body.publicTieBreakMode : undefined,
      timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    };

    const updated = await upsertPublicVoteConfig({ contestId, actorUserId: user.id, config });
    return NextResponse.json({ ok: true, config: updated });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    if (err instanceof JuryError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[jury public-vote-config]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error al actualizar la configuración de voto público." } },
      { status: 500 },
    );
  }
}
