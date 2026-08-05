import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../../lib/auth";
import { AdmissionError, allowReplacement } from "../../../../../../../../lib/fotorank/admission";

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
    reasonCode?: string;
    publicMessage?: string;
    internalNote?: string;
    deadlineAt?: string | null;
    requestId?: string;
  };
  try {
    const result = await allowReplacement({
      contestId,
      entryId,
      organizerUserId: user.id,
      reasonCode: body.reasonCode,
      publicMessage: body.publicMessage,
      internalNote: body.internalNote,
      deadlineAt: body.deadlineAt,
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
    console.error("[admission allow-replacement]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo habilitar reemplazo." } },
      { status: 500 },
    );
  }
}
