import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../../lib/auth";
import {
  AdmissionError,
  requestEvidence,
  type EvidenceType,
} from "../../../../../../../../lib/fotorank/admission";

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
    types?: EvidenceType[];
    reasonCode?: string;
    publicMessage?: string;
    internalNote?: string;
    deadlineAt?: string | null;
    requestId?: string;
  };
  if (!body.reasonCode?.trim()) {
    return NextResponse.json(
      { error: { code: "REASON_REQUIRED", message: "reasonCode obligatorio." } },
      { status: 400 },
    );
  }
  try {
    const result = await requestEvidence({
      contestId,
      entryId,
      organizerUserId: user.id,
      types: body.types ?? ["ORIGINAL"],
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
    if (err instanceof Error && err.message.startsWith("REASON_CODE_UNKNOWN")) {
      return NextResponse.json(
        { error: { code: "REASON_CODE_UNKNOWN", message: "Reason code no registrado." } },
        { status: 400 },
      );
    }
    console.error("[admission evidence]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo solicitar evidencia." } },
      { status: 500 },
    );
  }
}
