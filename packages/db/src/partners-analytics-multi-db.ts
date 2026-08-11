/**
 * Agregación multi-DB de analytics Partners (CK local + InfoSpot/CLF remotos).
 */
import type { PrismaClient } from "@prisma/client";
import {
  PARTNER_ANALYTICS_DISCLAIMER,
  buildTotals,
  labelApplication,
  labelDevice,
  labelPlacement,
  mergeBreakdownMaps,
  mergeDailySeries,
  resolveAnalyticsDateRange,
  type PartnerAnalyticsPeriod,
  type PartnerAnalyticsReport,
  type PartnerCreativeBreakdownRow,
  type PartnerDailyPoint,
} from "@repo/partners";
import {
  getPartnersPublicationClient,
  getPartnersPublicationTargetInfo,
} from "./partners-publication-targets";

type CountRow = { key: string; count: number };
type DayRow = { day: string; count: number };

async function countEvents(
  db: PrismaClient,
  table: "DnxPartnerImpressionEvent" | "DnxPartnerClickEvent",
  partnerId: string,
  from: Date,
  to: Date,
  groupBy: "application" | "campaignId" | "placement" | "creativeId" | "deviceClass" | null,
): Promise<CountRow[]> {
  if (!groupBy) {
    const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count
       FROM "${table}"
       WHERE "partnerId" = $1
         AND "occurredAt" >= $2 AND "occurredAt" <= $3
         ${table === "DnxPartnerImpressionEvent" ? 'AND "isBot" = false' : ""}`,
      partnerId,
      from,
      to,
    );
    return [{ key: "ALL", count: Number(rows[0]?.count ?? 0) }];
  }
  const col =
    groupBy === "campaignId"
      ? `"campaignId"`
      : groupBy === "creativeId"
        ? `"creativeId"`
        : groupBy === "deviceClass"
          ? `"deviceClass"::text`
          : groupBy === "placement"
            ? `"placement"::text`
            : `"application"::text`;
  // Clicks → campaign/creative: mapear por outboundLink visto en impresiones (sin cartesian product).
  if (table === "DnxPartnerClickEvent" && groupBy === "campaignId") {
    const rows = await db.$queryRawUnsafe<Array<{ key: string | null; count: bigint }>>(
      `SELECT map."campaignId" AS key, COUNT(DISTINCT ce.id)::bigint AS count
       FROM "DnxPartnerClickEvent" ce
       INNER JOIN (
         SELECT DISTINCT "outboundLinkId", "campaignId"
         FROM "DnxPartnerImpressionEvent"
         WHERE "partnerId" = $1
           AND "campaignId" IS NOT NULL
           AND "outboundLinkId" IS NOT NULL
           AND "isBot" = false
       ) map ON map."outboundLinkId" = ce."outboundLinkId"
       WHERE ce."partnerId" = $1
         AND ce."occurredAt" >= $2 AND ce."occurredAt" <= $3
       GROUP BY map."campaignId"`,
      partnerId,
      from,
      to,
    );
    return rows.filter((r) => r.key).map((r) => ({ key: String(r.key), count: Number(r.count) }));
  }
  if (table === "DnxPartnerClickEvent" && groupBy === "creativeId") {
    const rows = await db.$queryRawUnsafe<Array<{ key: string | null; count: bigint }>>(
      `SELECT map."creativeId" AS key, COUNT(DISTINCT ce.id)::bigint AS count
       FROM "DnxPartnerClickEvent" ce
       INNER JOIN (
         SELECT DISTINCT "outboundLinkId", "creativeId"
         FROM "DnxPartnerImpressionEvent"
         WHERE "partnerId" = $1
           AND "creativeId" IS NOT NULL
           AND "outboundLinkId" IS NOT NULL
           AND "isBot" = false
       ) map ON map."outboundLinkId" = ce."outboundLinkId"
       WHERE ce."partnerId" = $1
         AND ce."occurredAt" >= $2 AND ce."occurredAt" <= $3
       GROUP BY map."creativeId"`,
      partnerId,
      from,
      to,
    );
    return rows.filter((r) => r.key).map((r) => ({ key: String(r.key), count: Number(r.count) }));
  }
  const rows = await db.$queryRawUnsafe<Array<{ key: string | null; count: bigint }>>(
    `SELECT ${col} AS key, COUNT(*)::bigint AS count
     FROM "${table}"
     WHERE "partnerId" = $1
       AND "occurredAt" >= $2 AND "occurredAt" <= $3
       ${table === "DnxPartnerImpressionEvent" ? 'AND "isBot" = false' : ""}
       AND ${col} IS NOT NULL
     GROUP BY 1`,
    partnerId,
    from,
    to,
  );
  return rows.map((r) => ({ key: String(r.key), count: Number(r.count) }));
}

async function dailySeries(
  db: PrismaClient,
  table: "DnxPartnerImpressionEvent" | "DnxPartnerClickEvent",
  partnerId: string,
  from: Date,
  to: Date,
): Promise<DayRow[]> {
  const rows = await db.$queryRawUnsafe<Array<{ day: Date; count: bigint }>>(
    `SELECT date_trunc('day', "occurredAt" AT TIME ZONE 'UTC') AS day,
            COUNT(*)::bigint AS count
     FROM "${table}"
     WHERE "partnerId" = $1
       AND "occurredAt" >= $2 AND "occurredAt" <= $3
       ${table === "DnxPartnerImpressionEvent" ? 'AND "isBot" = false' : ""}
     GROUP BY 1
     ORDER BY 1`,
    partnerId,
    from,
    to,
  );
  return rows.map((r) => ({
    day: new Date(r.day).toISOString().slice(0, 10),
    count: Number(r.count),
  }));
}

function toMap(rows: CountRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.key] = (out[r.key] ?? 0) + r.count;
  return out;
}

function addMaps(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

export type MultiDbAnalyticsSourceStatus = {
  key: string;
  label: string;
  ok: boolean;
  error?: string;
};

export async function loadPartnerAnalyticsMultiDb(input: {
  localDb: PrismaClient;
  partnerId: string;
  partnerName: string;
  period: PartnerAnalyticsPeriod;
  from?: string | null;
  to?: string | null;
}): Promise<{ report: PartnerAnalyticsReport; sources: MultiDbAnalyticsSourceStatus[] }> {
  const range = resolveAnalyticsDateRange({
    period: input.period,
    from: input.from,
    to: input.to,
  });

  const sources: MultiDbAnalyticsSourceStatus[] = [];
  const clients: Array<{ key: string; label: string; db: PrismaClient }> = [
    { key: "CLICKATON", label: "Clickatón", db: input.localDb },
  ];

  for (const [dbKey, label, appHint] of [
    ["INFOSPOT", "InfoSpot", "INFO_SPOT"],
    ["CLF", "ComprameLaFoto", "COMPRAME_LA_FOTO"],
  ] as const) {
    const info = getPartnersPublicationTargetInfo(dbKey);
    if (!info.configured) {
      sources.push({ key: appHint, label, ok: false, error: "no_config" });
      continue;
    }
    try {
      clients.push({ key: appHint, label, db: getPartnersPublicationClient(dbKey) });
    } catch (e) {
      sources.push({
        key: appHint,
        label,
        ok: false,
        error: e instanceof Error ? e.message : "client_error",
      });
    }
  }

  let impressionsTotal = 0;
  let clicksTotal = 0;
  let impByApp: Record<string, number> = {};
  let clickByApp: Record<string, number> = {};
  let impByCampaign: Record<string, number> = {};
  let clickByCampaign: Record<string, number> = {};
  let impByPlacement: Record<string, number> = {};
  let clickByPlacement: Record<string, number> = {};
  let impByCreative: Record<string, number> = {};
  let clickByCreative: Record<string, number> = {};
  let impByDevice: Record<string, number> = {};
  let clickByDevice: Record<string, number> = {};
  let dailyImp: DayRow[] = [];
  let dailyClick: DayRow[] = [];

  const campaignMeta = new Map<string, { name: string; status: string }>();
  const creativeMeta = new Map<
    string,
    { name: string; format: string | null; deviceTarget: string | null; thumb: string | null }
  >();

  for (const c of clients) {
    try {
      const [
        iAll,
        cAll,
        iApp,
        cApp,
        iCamp,
        cCamp,
        iPlace,
        cPlace,
        iCreat,
        cCreat,
        iDev,
        cDev,
        iDay,
        cDay,
      ] = await Promise.all([
        countEvents(c.db, "DnxPartnerImpressionEvent", input.partnerId, range.from, range.to, null),
        countEvents(c.db, "DnxPartnerClickEvent", input.partnerId, range.from, range.to, null),
        countEvents(
          c.db,
          "DnxPartnerImpressionEvent",
          input.partnerId,
          range.from,
          range.to,
          "application",
        ),
        countEvents(
          c.db,
          "DnxPartnerClickEvent",
          input.partnerId,
          range.from,
          range.to,
          "application",
        ),
        countEvents(
          c.db,
          "DnxPartnerImpressionEvent",
          input.partnerId,
          range.from,
          range.to,
          "campaignId",
        ),
        countEvents(
          c.db,
          "DnxPartnerClickEvent",
          input.partnerId,
          range.from,
          range.to,
          "campaignId",
        ),
        countEvents(
          c.db,
          "DnxPartnerImpressionEvent",
          input.partnerId,
          range.from,
          range.to,
          "placement",
        ),
        countEvents(
          c.db,
          "DnxPartnerClickEvent",
          input.partnerId,
          range.from,
          range.to,
          "placement",
        ),
        countEvents(
          c.db,
          "DnxPartnerImpressionEvent",
          input.partnerId,
          range.from,
          range.to,
          "creativeId",
        ),
        countEvents(
          c.db,
          "DnxPartnerClickEvent",
          input.partnerId,
          range.from,
          range.to,
          "creativeId",
        ),
        countEvents(
          c.db,
          "DnxPartnerImpressionEvent",
          input.partnerId,
          range.from,
          range.to,
          "deviceClass",
        ),
        countEvents(
          c.db,
          "DnxPartnerClickEvent",
          input.partnerId,
          range.from,
          range.to,
          "deviceClass",
        ),
        dailySeries(c.db, "DnxPartnerImpressionEvent", input.partnerId, range.from, range.to),
        dailySeries(c.db, "DnxPartnerClickEvent", input.partnerId, range.from, range.to),
      ]);

      impressionsTotal += iAll[0]?.count ?? 0;
      clicksTotal += cAll[0]?.count ?? 0;
      impByApp = addMaps(impByApp, toMap(iApp));
      clickByApp = addMaps(clickByApp, toMap(cApp));
      impByCampaign = addMaps(impByCampaign, toMap(iCamp));
      clickByCampaign = addMaps(clickByCampaign, toMap(cCamp));
      impByPlacement = addMaps(impByPlacement, toMap(iPlace));
      clickByPlacement = addMaps(clickByPlacement, toMap(cPlace));
      impByCreative = addMaps(impByCreative, toMap(iCreat));
      clickByCreative = addMaps(clickByCreative, toMap(cCreat));
      impByDevice = addMaps(impByDevice, toMap(iDev));
      clickByDevice = addMaps(clickByDevice, toMap(cDev));
      dailyImp = [...dailyImp, ...iDay];
      dailyClick = [...dailyClick, ...cDay];

      // Enrich campaign/creative labels from this DB
      const campIds = Object.keys(toMap(iCamp));
      if (campIds.length) {
        const camps = await c.db.dnxPartnerCampaign.findMany({
          where: { id: { in: campIds } },
          select: { id: true, name: true, status: true },
        });
        for (const camp of camps) {
          campaignMeta.set(camp.id, { name: camp.name, status: camp.status });
        }
      }
      const crIds = Object.keys(toMap(iCreat));
      if (crIds.length) {
        const crs = await c.db.dnxPartnerCampaignCreative.findMany({
          where: { id: { in: crIds } },
          select: {
            id: true,
            format: true,
            deviceTarget: true,
            title: true,
            asset: { select: { fileUrl: true } },
          },
        });
        for (const cr of crs) {
          creativeMeta.set(cr.id, {
            name: cr.title?.trim() || cr.format,
            format: cr.format,
            deviceTarget: cr.deviceTarget,
            thumb: cr.asset.fileUrl,
          });
        }
      }

      sources.push({ key: c.key, label: c.label, ok: true });
    } catch (e) {
      sources.push({
        key: c.key,
        label: c.label,
        ok: false,
        error: e instanceof Error ? e.message : "query_failed",
      });
    }
  }

  // Active campaigns: from local CK
  let activeCampaigns = 0;
  try {
    activeCampaigns = await input.localDb.dnxPartnerCampaign.count({
      where: { partnerId: input.partnerId, status: "ACTIVE", archivedAt: null },
    });
  } catch {
    activeCampaigns = 0;
  }

  const dailyMergedImp = toMap(
    dailyImp.map((d) => ({ key: d.day, count: d.count })),
  );
  const dailyMergedClick = toMap(
    dailyClick.map((d) => ({ key: d.day, count: d.count })),
  );
  const daily: PartnerDailyPoint[] = mergeDailySeries(
    Object.entries(dailyMergedImp).map(([day, count]) => ({ day, count })),
    Object.entries(dailyMergedClick).map(([day, count]) => ({ day, count })),
  );

  const byCreative: PartnerCreativeBreakdownRow[] = mergeBreakdownMaps(
    impByCreative,
    clickByCreative,
    (key) => creativeMeta.get(key)?.name ?? key.slice(0, 8),
  ).map((row) => {
    const meta = creativeMeta.get(row.key);
    return {
      ...row,
      thumbnailUrl: meta?.thumb ?? null,
      format: meta?.format ?? null,
      deviceTarget: meta?.deviceTarget ?? null,
    };
  });

  const report: PartnerAnalyticsReport = {
    partnerId: input.partnerId,
    partnerName: input.partnerName,
    range,
    totals: buildTotals({
      impressions: impressionsTotal,
      clicks: clicksTotal,
      activeCampaigns,
    }),
    byApplication: mergeBreakdownMaps(impByApp, clickByApp, labelApplication).filter(
      (r) => r.impressions > 0 || r.clicks > 0,
    ),
    byCampaign: mergeBreakdownMaps(
      impByCampaign,
      clickByCampaign,
      (key) => campaignMeta.get(key)?.name ?? key,
    ).map((row) => ({
      ...row,
      status: campaignMeta.get(row.key)?.status ?? null,
    })),
    byPlacement: mergeBreakdownMaps(impByPlacement, clickByPlacement, labelPlacement),
    byCreative,
    byDevice: mergeBreakdownMaps(impByDevice, clickByDevice, labelDevice),
    daily,
    disclaimer: PARTNER_ANALYTICS_DISCLAIMER,
  };

  return { report, sources };
}
