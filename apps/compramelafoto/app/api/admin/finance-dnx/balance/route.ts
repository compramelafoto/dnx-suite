import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildBalance } from "@/lib/finance-dnx/revenue/balance";
import { monthKeysSince } from "@/lib/finance-dnx/revenue/compute";
import { REVENUE_SINCE } from "@/lib/finance-dnx/revenue/sources";
import { REVENUE_PLATFORMS } from "@/lib/finance-dnx/revenue/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAID = ["PAGADO", "REEMBOLSADO"];

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  try {
    const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear();
    const months = monthKeysSince(REVENUE_SINCE, new Date()).filter((m) => m.periodYear === year);
    const [snapshots, entries] = await Promise.all([
      prisma.platformRevenueSnapshot.findMany({ where: { periodYear: year, platformKey: { in: [...REVENUE_PLATFORMS] } }, orderBy: [{ periodMonth: "asc" }, { platformKey: "asc" }] }),
      prisma.expenseEntry.findMany({
        where: { periodYear: year, status: { in: PAID } },
        select: { periodMonth: true, amountArs: true, amountRefunded: true, fxRate: true, allocations: { select: { platformKey: true, amountArs: true } } },
      }),
    ]);

    // Gasto pagado neto de reembolsos (los reembolsos se guardan en la moneda original).
    const expensesByMonth = new Map<number, { paidArs: number; byPlatform: Record<string, number> }>();
    for (const e of entries) {
      const amountArs = e.amountArs.toNumber();
      const refundedArs = (e.amountRefunded?.toNumber() ?? 0) * (e.fxRate?.toNumber() ?? 1);
      const net = Math.max(0, amountArs - refundedArs);
      const factor = amountArs > 0 ? net / amountArs : 0;
      const m = expensesByMonth.get(e.periodMonth) ?? { paidArs: 0, byPlatform: {} };
      m.paidArs += net;
      for (const a of e.allocations) m.byPlatform[a.platformKey] = (m.byPlatform[a.platformKey] ?? 0) + a.amountArs.toNumber() * factor;
      expensesByMonth.set(e.periodMonth, m);
    }

    const balance = buildBalance({
      months,
      revenue: snapshots.map((s) => ({ platformKey: s.platformKey, periodYear: s.periodYear, periodMonth: s.periodMonth, netArs: s.netArs.toNumber() })),
      expenses: [...expensesByMonth.entries()].map(([periodMonth, v]) => ({ periodYear: year, periodMonth, ...v })),
    });

    const detail = snapshots.map((s) => ({
      platformKey: s.platformKey,
      periodMonth: s.periodMonth,
      grossArs: s.grossArs.toNumber(),
      processorFeeArs: s.processorFeeArs.toNumber(),
      payoutToThirdPartiesArs: s.payoutToThirdPartiesArs.toNumber(),
      netArs: s.netArs.toNumber(),
      operationsCount: s.operationsCount,
    }));
    const latest = new Map<string, { computedAt: Date; note: string | null }>();
    for (const s of snapshots) {
      const prev = latest.get(s.platformKey);
      if (!prev || s.computedAt > prev.computedAt) latest.set(s.platformKey, { computedAt: s.computedAt, note: s.sourceNote });
    }
    return NextResponse.json({
      year,
      ...balance,
      detail,
      sources: [...latest.entries()].map(([platformKey, v]) => ({ platformKey, ...v })),
    });
  } catch (err: any) {
    console.error("GET /api/admin/finance-dnx/balance ERROR >>>", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
