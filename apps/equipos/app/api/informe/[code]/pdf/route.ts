import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@repo/auth-guards";
import { buildInsuranceReportPdf } from "@/lib/informe/pdf";
import { findOwnReport, type ReportSnapshot } from "@/lib/informe/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sólo el dueño descarga el PDF; para cualquier otra persona el informe «no existe». */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const user = await getCurrentUser();
  const report = user ? await findOwnReport(user.id, code) : null;
  if (!report) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const base = (process.env.APP_URL?.trim() || req.nextUrl.origin).replace(/\/$/, "");
  const bytes = await buildInsuranceReportPdf(
    report.snapshot as unknown as ReportSnapshot,
    `${base}/informe/${report.code}`,
    report.contentHash,
  );
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informe-equipamiento-${report.createdAt.toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
