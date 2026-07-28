import { NextResponse } from "next/server";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { AdmissionError } from "@/lib/technical-admission/errors";
import { exportAdmissionCsv } from "@/lib/technical-admission/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ editionId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const user = await requireClickatonAdmin();
  const { editionId } = await ctx.params;
  const mode = new URL(req.url).searchParams.get("mode") === "jury" ? "jury" : "admin";
  try {
    const csv = await exportAdmissionCsv(
      editionId,
      { id: user.id, email: user.email, globalRole: user.globalRole },
      mode,
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="admission-${mode}-${editionId}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AdmissionError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
