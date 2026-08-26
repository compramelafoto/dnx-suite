import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import {
  AdmissionError,
  getAdmissionEntryDetail,
} from "../../../../../../../lib/fotorank/admission";

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } },
      { status: 401 },
    );
  }
  const { contestId, entryId } = await ctx.params;
  const revealArgra = new URL(req.url).searchParams.get("revealArgra") === "1";
  try {
    const detail = await getAdmissionEntryDetail({
      contestId,
      entryId,
      organizerUserId: user.id,
      revealArgra,
    });
    return NextResponse.json({ ok: true, detail });
  } catch (err) {
    if (err instanceof AdmissionError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    console.error("[admission detail]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo cargar el detalle." } },
      { status: 500 },
    );
  }
}
