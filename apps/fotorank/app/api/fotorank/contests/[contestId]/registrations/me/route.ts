import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import {
  RegistrationError,
  cancelMyContestRegistration,
  getMyContestRegistration,
} from "../../../../../../lib/fotorank/registration";

type Ctx = { params: Promise<{ contestId: string }> };

function serialize(reg: NonNullable<Awaited<ReturnType<typeof getMyContestRegistration>>>) {
  return {
    id: reg.id,
    contestId: reg.contestId,
    contestTitle: reg.contestTitle,
    contestSlug: reg.contestSlug,
    categoryId: reg.categoryId,
    categoryName: reg.categoryName,
    status: reg.status,
    paymentStatus: reg.paymentStatus,
    registrationNumber: reg.registrationNumber,
    rulesVersionId: reg.rulesVersionId,
    rulesVersionNumber: reg.rulesVersionNumber,
    rulesAcceptedAt: reg.rulesAcceptedAt.toISOString(),
    paymentModeSnapshot: reg.paymentModeSnapshot,
    registrationPriceSnapshot: reg.registrationPriceSnapshot,
    currencySnapshot: reg.currencySnapshot,
    platformFeeBpsSnapshot: reg.platformFeeBpsSnapshot,
    paymentRequired: reg.paymentRequired,
    checkoutUrl: reg.checkoutUrl,
    photoUploadStatus: reg.photoUploadStatus,
    confirmedAt: reg.confirmedAt?.toISOString() ?? null,
    cancelledAt: reg.cancelledAt?.toISOString() ?? null,
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  const reg = await getMyContestRegistration(contestId, user.id);
  if (!reg) {
    return NextResponse.json({ error: { code: "REGISTRATION_NOT_FOUND", message: "Sin inscripción." } }, { status: 404 });
  }
  return NextResponse.json({ ok: true, registration: serialize(reg) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  try {
    const reg = await cancelMyContestRegistration(contestId, user.id);
    return NextResponse.json({ ok: true, registration: serialize(reg) });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.httpStatus },
      );
    }
    console.error("[fotorank registrations DELETE]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo cancelar." } },
      { status: 500 },
    );
  }
}
