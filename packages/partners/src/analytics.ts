/**
 * Partner Analytics — agregados CTR / rangos / breakdowns (sin PII).
 * Timezone de agregación: UTC (documentado).
 */

import type { DnxPartnerApplication } from "./types";
import type { DnxPartnerDeviceClass, DnxPartnerPlacement } from "./tracking";

export const PARTNER_ANALYTICS_TIMEZONE = "UTC" as const;

export const PARTNER_ANALYTICS_PERIODS = [
  "today",
  "last_7_days",
  "last_30_days",
  "this_month",
  "custom",
] as const;
export type PartnerAnalyticsPeriod = (typeof PARTNER_ANALYTICS_PERIODS)[number];

export const PARTNER_IMPRESSION_SOURCE_TYPES = ["CAMPAIGN", "PARTICIPATION"] as const;
export type PartnerImpressionSourceType = (typeof PARTNER_IMPRESSION_SOURCE_TYPES)[number];

/** Viewability: ≥50% visible durante ≥1s */
export const PARTNER_VIEWABILITY_RATIO = 0.5;
export const PARTNER_VIEWABILITY_MS = 1000;

/** Roles institucionales: NO cuentan como advertising impression por defecto. */
export const PARTNER_INSTITUTIONAL_ROLES_NO_ADS = [
  "ORGANIZER",
  "CO_ORGANIZER",
] as const;

export type PartnerAnalyticsDateRange = {
  from: Date;
  to: Date;
  period: PartnerAnalyticsPeriod;
  timezone: typeof PARTNER_ANALYTICS_TIMEZONE;
};

export type PartnerMetricTotals = {
  impressions: number;
  clicks: number;
  /** null si impressions === 0 */
  ctrPercent: number | null;
  activeCampaigns: number;
};

export type PartnerBreakdownRow = {
  key: string;
  label: string;
  impressions: number;
  clicks: number;
  ctrPercent: number | null;
};

export type PartnerCreativeBreakdownRow = PartnerBreakdownRow & {
  thumbnailUrl: string | null;
  format: string | null;
  deviceTarget: string | null;
};

export type PartnerDailyPoint = {
  day: string; // YYYY-MM-DD UTC
  impressions: number;
  clicks: number;
};

export type PartnerAnalyticsReport = {
  partnerId: string;
  partnerName: string;
  range: PartnerAnalyticsDateRange;
  totals: PartnerMetricTotals;
  byApplication: PartnerBreakdownRow[];
  byCampaign: Array<PartnerBreakdownRow & { status: string | null }>;
  byPlacement: PartnerBreakdownRow[];
  byCreative: PartnerCreativeBreakdownRow[];
  byDevice: PartnerBreakdownRow[];
  daily: PartnerDailyPoint[];
  disclaimer: string;
};

export const PARTNER_ANALYTICS_DISCLAIMER =
  "Los clicks representan interacciones con las piezas del Partner y no implican necesariamente una compra o conversión. Las impresiones miden presentación visible de creatives, no personas únicas.";

export function computeCtrPercent(impressions: number, clicks: number): number | null {
  if (impressions <= 0) return null;
  return Math.round((clicks / impressions) * 10000) / 100;
}

export function formatCtrDisplay(ctr: number | null): string {
  if (ctr === null) return "N/A";
  return `${ctr.toFixed(2)}%`;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );
}

export function resolveAnalyticsDateRange(input: {
  period: PartnerAnalyticsPeriod;
  from?: Date | string | null;
  to?: Date | string | null;
  now?: Date;
}): PartnerAnalyticsDateRange {
  const now = input.now ?? new Date();
  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(now);

  if (input.period === "today") {
    return { from: todayStart, to: todayEnd, period: "today", timezone: "UTC" };
  }
  if (input.period === "last_7_days") {
    const from = new Date(todayStart);
    from.setUTCDate(from.getUTCDate() - 6);
    return { from, to: todayEnd, period: "last_7_days", timezone: "UTC" };
  }
  if (input.period === "last_30_days") {
    const from = new Date(todayStart);
    from.setUTCDate(from.getUTCDate() - 29);
    return { from, to: todayEnd, period: "last_30_days", timezone: "UTC" };
  }
  if (input.period === "this_month") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { from, to: todayEnd, period: "this_month", timezone: "UTC" };
  }
  const from = input.from ? new Date(input.from) : todayStart;
  const to = input.to ? endOfUtcDay(new Date(input.to)) : todayEnd;
  return {
    from: startOfUtcDay(from),
    to,
    period: "custom",
    timezone: "UTC",
  };
}

export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildTotals(input: {
  impressions: number;
  clicks: number;
  activeCampaigns: number;
}): PartnerMetricTotals {
  return {
    impressions: input.impressions,
    clicks: input.clicks,
    ctrPercent: computeCtrPercent(input.impressions, input.clicks),
    activeCampaigns: input.activeCampaigns,
  };
}

export function mergeBreakdownMaps(
  impressions: Record<string, number>,
  clicks: Record<string, number>,
  labelFor: (key: string) => string,
): PartnerBreakdownRow[] {
  const keys = new Set([...Object.keys(impressions), ...Object.keys(clicks)]);
  return [...keys]
    .map((key) => {
      const i = impressions[key] ?? 0;
      const c = clicks[key] ?? 0;
      return {
        key,
        label: labelFor(key),
        impressions: i,
        clicks: c,
        ctrPercent: computeCtrPercent(i, c),
      };
    })
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
}

export function mergeDailySeries(
  impressions: Array<{ day: string; count: number }>,
  clicks: Array<{ day: string; count: number }>,
): PartnerDailyPoint[] {
  const map = new Map<string, PartnerDailyPoint>();
  for (const row of impressions) {
    map.set(row.day, {
      day: row.day,
      impressions: row.count,
      clicks: map.get(row.day)?.clicks ?? 0,
    });
  }
  for (const row of clicks) {
    const prev = map.get(row.day) ?? { day: row.day, impressions: 0, clicks: 0 };
    prev.clicks = row.count;
    map.set(row.day, prev);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export const APPLICATION_ANALYTICS_LABELS: Record<string, string> = {
  CLICKATON: "Clickatón",
  FOTO_RANK: "FotoRank",
  INFO_SPOT: "InfoSpot",
  COMPRAME_LA_FOTO: "ComprameLaFoto",
  DNX_SUITE: "DNX Suite",
  FOTO_OFFICE: "FotoOffice",
  OTHER: "Otra",
};

export const DEVICE_ANALYTICS_LABELS: Record<DnxPartnerDeviceClass, string> = {
  DESKTOP: "Desktop",
  MOBILE: "Mobile",
  TABLET: "Tablet",
  OTHER: "Other",
};

export const PLACEMENT_ANALYTICS_LABELS: Partial<Record<DnxPartnerPlacement, string>> = {
  LOGO_MARQUEE: "Marquee de logos",
  WELCOME: "Welcome interstitial",
  HOME_INLINE: "Home inline",
  BANNER: "Banner",
  GALLERY_INLINE: "Gallery inline",
  PHOTO_DETAIL: "Photo detail",
  EVENT_PAGE: "Página de evento",
  ARTICLE: "Artículo",
  CARD_PROMO: "Card promo",
  LOGO: "Logo",
  SPONSOR_SECTION: "Sección sponsors",
  ORGANIZER_SECTION: "Sección organizadores",
};

export function labelApplication(app: string): string {
  return APPLICATION_ANALYTICS_LABELS[app] ?? app;
}

export function labelPlacement(placement: string): string {
  return (
    PLACEMENT_ANALYTICS_LABELS[placement as DnxPartnerPlacement] ??
    placement.replace(/_/g, " ").toLowerCase()
  );
}

export function labelDevice(device: string): string {
  return DEVICE_ANALYTICS_LABELS[device as DnxPartnerDeviceClass] ?? device;
}

export function isPartnerImpressionTrackingEnabled(): boolean {
  return process.env.DNX_PARTNER_IMPRESSION_TRACKING_ENABLED !== "false";
}

export function analyticsLogicalViewKey(input: {
  campaignId: string;
  creativeId: string;
  placementKey: string;
}): string {
  return `${input.campaignId}:${input.creativeId}:${input.placementKey}`;
}

export function extractTrackingKeyFromHref(href: string | null | undefined): string | null {
  if (!href?.trim()) return null;
  try {
    const path = href.startsWith("http") ? new URL(href).pathname : href;
    const m = path.match(/\/r\/([^/?#]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export type ImpressionIngestInput = {
  trackingKey: string;
  creativeId: string;
  placementKey: string;
  application: DnxPartnerApplication;
  viewSessionKey?: string | null;
  userAgent?: string | null;
  clientSeed?: string | null;
};

export function partnerAnalyticsCsv(report: PartnerAnalyticsReport): string {
  const lines: string[] = [];
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  lines.push("section,key,label,impressions,clicks,ctr_percent");
  lines.push(
    [
      "totals",
      "ALL",
      "Totales",
      report.totals.impressions,
      report.totals.clicks,
      report.totals.ctrPercent ?? "",
    ]
      .map(esc)
      .join(","),
  );
  for (const row of [
    ...report.byApplication.map((r) => ({ section: "application", ...r })),
    ...report.byCampaign.map((r) => ({ section: "campaign", ...r })),
    ...report.byPlacement.map((r) => ({ section: "placement", ...r })),
    ...report.byCreative.map((r) => ({ section: "creative", ...r })),
    ...report.byDevice.map((r) => ({ section: "device", ...r })),
  ]) {
    lines.push(
      [row.section, row.key, row.label, row.impressions, row.clicks, row.ctrPercent ?? ""]
        .map(esc)
        .join(","),
    );
  }
  lines.push("day,impressions,clicks");
  for (const d of report.daily) {
    lines.push([d.day, d.impressions, d.clicks].map(esc).join(","));
  }
  return lines.join("\n");
}
