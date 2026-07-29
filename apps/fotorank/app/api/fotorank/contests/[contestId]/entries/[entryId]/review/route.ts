import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { EntryError, createManualReview } from "../../../../../../../lib/fotorank/entries";

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId, entryId } = await ctx.params;
  const body = (await req.json()) as {
    decision?: "APPROVED" | "REPLACEMENT_REQUESTED" | "REJECTED" | "CLEARED_WARNING";
    reason?: string;
    notes?: string;
  };
  if (!body.decision) {
    return NextResponse.json({ error: { code: "INVALID_BODY", message: "decision requerida." } }, { status: 400 });
  }
  try {
    const review = await createManualReview({
      contestId,
      entryId,
      reviewerUserId: user.id,
      decision: body.decision,
      reason: body.reason,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, reviewId: review.id, decision: review.decision });
  } catch (err) {
    if (err instanceof EntryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[entry review]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "No se pudo registrar la revisión." } }, { status: 500 });
  }
}
