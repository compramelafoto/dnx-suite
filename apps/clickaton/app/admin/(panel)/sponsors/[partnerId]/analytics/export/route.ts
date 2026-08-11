import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { loadPartnerAnalyticsMultiDb } from "@repo/db/partners-analytics-multi-db";
import {
  PARTNER_ANALYTICS_PERIODS,
  partnerAnalyticsCsv,
  type PartnerAnalyticsPeriod,
} from "@repo/partners";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePeriod(raw: string | null): PartnerAnalyticsPeriod {
  if (raw && (PARTNER_ANALYTICS_PERIODS as readonly string[]).includes(raw)) {
    return raw as PartnerAnalyticsPeriod;
  }
  return "last_7_days";
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ partnerId: string }> },
) {
  await requireClickatonAdmin();
  const { partnerId } = await ctx.params;
  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));

  const loaded = await withClickatonDb(async () => {
    const partner = await prisma.dnxPartner.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true },
    });
    if (!partner) return null;
    return loadPartnerAnalyticsMultiDb({
      localDb: prisma,
      partnerId: partner.id,
      partnerName: partner.name,
      period,
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
  });

  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.message }, { status: 503 });
  }
  if (!loaded.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const csv = partnerAnalyticsCsv(loaded.data.report);
  const filename = `partner-analytics-${partnerId}-${period}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, max-age=60",
    },
  });
}
