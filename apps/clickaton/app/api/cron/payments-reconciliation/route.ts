import { NextResponse } from "next/server";
import { runPaymentsReconciliationBatch } from "@/lib/checkout/application/run-payments-reconciliation-batch";
import { runRefundsReconciliationBatch } from "@/lib/checkout/application/run-refunds-reconciliation-batch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/payments-reconciliation
 * Auth: Bearer CRON_SECRET | CLICKATON_CRON_SECRET, or Vercel Cron header.
 *
 * Incluye lote de refunds (feature-flagged; prod off por default).
 */
export async function GET(request: Request) {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  const ok =
    (Boolean(secret) && auth === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && vercelCron === "1");
  if (!ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "25");
  const cursorId = url.searchParams.get("cursor");
  const refundLimitRaw = Number(url.searchParams.get("refundLimit") ?? "15");

  const result = await runPaymentsReconciliationBatch({
    limit: Number.isFinite(limitRaw) ? limitRaw : 25,
    cursorId,
  });

  const refunds = await runRefundsReconciliationBatch({
    limit: Number.isFinite(refundLimitRaw) ? refundLimitRaw : 15,
    cursorId: url.searchParams.get("refundCursor"),
  });

  return NextResponse.json({ ...result, refunds });
}
