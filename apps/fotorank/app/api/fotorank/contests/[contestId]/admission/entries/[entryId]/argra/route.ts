import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../../lib/auth";
import { AdmissionError, verifyArgra } from "../../../../../../../../lib/fotorank/admission";
import type { ArgraVerificationStatus } from "../../../../../../../../lib/fotorank/eligibility";

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } },
      { status: 401 },
    );
  }
  const { contestId, entryId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: ArgraVerificationStatus;
    internalNote?: string;
    requestId?: string;
  };
  if (!body.status) {
    return NextResponse.json(
      { error: { code: "STATUS_REQUIRED", message: "status ARGRA obligatorio." } },
      { status: 400 },
    );
  }
  try {
    const result = await verifyArgra({
      contestId,
      entryId,
      organizerUserId: user.id,
      status: body.status,
      internalNote: body.internalNote,
      requestId: body.requestId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AdmissionError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    console.error("[admission argra]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo actualizar ARGRA." } },
      { status: 500 },
    );
  }
}
