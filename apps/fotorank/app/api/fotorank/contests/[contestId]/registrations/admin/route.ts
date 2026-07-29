import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { EntryError, listContestEntriesForOrganizer } from "../../../../../../lib/fotorank/entries";

type Ctx = { params: Promise<{ contestId: string }> };

/** Panel organizador: listado de inscripciones + estado de obra. */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  try {
    const rows = await listContestEntriesForOrganizer({
      contestId,
      organizerUserId: user.id,
    });
    const stats = {
      totalRegistrations: rows.length,
      withoutPhoto: rows.filter((r) => !r.entryId).length,
      uploaded: rows.filter((r) => r.entryId && r.entryStatus !== "DRAFT").length,
      confirmed: rows.filter((r) => r.entryStatus === "CONFIRMED").length,
      approved: rows.filter((r) => r.technicalSummaryStatus === "APPROVED").length,
      approvedWithWarnings: rows.filter((r) => r.technicalSummaryStatus === "APPROVED_WITH_WARNINGS").length,
      requiresReview: rows.filter((r) => r.technicalSummaryStatus === "REQUIRES_REVIEW").length,
      rejected: rows.filter((r) => r.entryStatus === "REJECTED" || r.technicalSummaryStatus === "TECHNICALLY_REJECTED").length,
    };
    return NextResponse.json({ ok: true, stats, rows });
  } catch (err) {
    if (err instanceof EntryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[admin registrations]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "Error al listar." } }, { status: 500 });
  }
}
