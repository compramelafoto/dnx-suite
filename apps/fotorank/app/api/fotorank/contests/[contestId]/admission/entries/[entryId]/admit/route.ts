import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../../lib/auth";
import { AdmissionError, admitEntry } from "../../../../../../../../lib/fotorank/admission";

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
    notes?: string;
    requestId?: string;
  };
  try {
    const result = await admitEntry({
      contestId,
      entryId,
      organizerUserId: user.id,
      reasonCode: body.reasonCode,
      notes: body.notes,
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
    if (err instanceof Error && err.message.startsWith("REASON_CODE_UNKNOWN")) {
      return NextResponse.json(
        { error: { code: "REASON_CODE_UNKNOWN", message: "Reason code no registrado." } },
        { status: 400 },
      );
    }
    console.error("[admission admit]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo admitir." } },
      { status: 500 },
    );
  }
}
