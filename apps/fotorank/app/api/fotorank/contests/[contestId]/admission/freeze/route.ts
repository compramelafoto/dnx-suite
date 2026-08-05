import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import {
  AdmissionError,
  freezeAdmittedEntries,
} from "../../../../../../lib/fotorank/admission";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * POST body (freeze selectivo):
 * - dryRun: true (default)
 * - categorySlugs?: string[]
 * - entryIds?: string[]
 * - selectionHash + expectedCount + confirmPhrase requeridos en apply (dryRun:false)
 */
export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } },
      { status: 401 },
    );
  }
  const { contestId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    dryRun?: boolean;
    categorySlugs?: string[];
    entryIds?: string[];
    selectionHash?: string;
    expectedCount?: number;
    confirmPhrase?: string;
    batchId?: string;
    requestId?: string;
  };
  const dryRun = body.dryRun !== false;
  try {
    const result = await freezeAdmittedEntries({
      contestId,
      organizerUserId: user.id,
      dryRun,
      categorySlugs: body.categorySlugs,
      entryIds: body.entryIds,
      selectionHash: body.selectionHash,
      expectedCount: body.expectedCount,
      confirmPhrase: body.confirmPhrase,
      batchId: body.batchId,
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
    console.error("[admission freeze]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo ejecutar freeze." } },
      { status: 500 },
    );
  }
}
