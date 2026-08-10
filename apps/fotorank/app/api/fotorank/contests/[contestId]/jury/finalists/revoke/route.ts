import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../../../lib/fotorank/registration";
import { revokeFinalist } from "../../../../../../../lib/fotorank/jury/finalist-package";
import { JuryError } from "../../../../../../../lib/fotorank/jury/errors";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Revoca un finalista puntual con motivo auditado (ETAPA 16B, §8 master rules).
 * Invalida el paquete CONFIRMED asociado y promueve al próximo candidato elegible si existe.
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

    const body = (await req.json().catch(() => ({}))) as { snapshotId?: string; reason?: string };
    if (!body.snapshotId) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "snapshotId es obligatorio." } },
        { status: 400 },
      );
    }

    const result = await revokeFinalist({
      snapshotId: body.snapshotId,
      reason: body.reason?.trim() ?? "",
      actorUserId: user.id,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    if (err instanceof JuryError) {
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[jury finalists revoke]", err);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL", message: "Error al revocar el finalista." } },
      { status: 500 },
    );
  }
}
