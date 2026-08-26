import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PARTNER_INSTITUTIONAL_ROLES_NO_ADS,
  PARTNER_VIEWABILITY_MS,
  PARTNER_VIEWABILITY_RATIO,
  analyticsLogicalViewKey,
  computeCtrPercent,
  extractTrackingKeyFromHref,
  formatCtrDisplay,
  mergeBreakdownMaps,
  mergeDailySeries,
  partnerAnalyticsCsv,
  resolveAnalyticsDateRange,
} from "./analytics";

describe("partner analytics CTR", () => {
  it("computes CTR with 2 decimals", () => {
    assert.equal(computeCtrPercent(1000, 25), 2.5);
    assert.equal(formatCtrDisplay(2.5), "2.50%");
  });

  it("returns null CTR when impressions are zero", () => {
    assert.equal(computeCtrPercent(0, 5), null);
    assert.equal(formatCtrDisplay(null), "N/A");
  });
});

describe("partner analytics date ranges (UTC)", () => {
  const now = new Date("2026-08-11T15:30:00.000Z");

  it("today", () => {
    const r = resolveAnalyticsDateRange({ period: "today", now });
    assert.equal(r.from.toISOString(), "2026-08-11T00:00:00.000Z");
    assert.equal(r.timezone, "UTC");
  });

  it("last 7 days inclusive of today", () => {
    const r = resolveAnalyticsDateRange({ period: "last_7_days", now });
    assert.equal(r.from.toISOString(), "2026-08-05T00:00:00.000Z");
  });

  it("this month", () => {
    const r = resolveAnalyticsDateRange({ period: "this_month", now });
    assert.equal(r.from.toISOString(), "2026-08-01T00:00:00.000Z");
  });

  it("custom range", () => {
    const r = resolveAnalyticsDateRange({
      period: "custom",
      from: "2026-07-01",
      to: "2026-07-31",
      now,
    });
    assert.equal(r.from.toISOString().slice(0, 10), "2026-07-01");
    assert.equal(r.to.toISOString().slice(0, 10), "2026-07-31");
  });
});

describe("partner analytics breakdowns", () => {
  it("merges by application", () => {
    const rows = mergeBreakdownMaps(
      { INFO_SPOT: 12430, COMPRAME_LA_FOTO: 5210 },
      { INFO_SPOT: 350, COMPRAME_LA_FOTO: 110 },
      (k) => k,
    );
    assert.equal(rows[0]?.key, "INFO_SPOT");
    assert.equal(rows[0]?.ctrPercent, 2.82);
  });

  it("merges daily series", () => {
    const daily = mergeDailySeries(
      [
        { day: "2026-08-10", count: 10 },
        { day: "2026-08-11", count: 20 },
      ],
      [{ day: "2026-08-11", count: 3 }],
    );
    assert.deepEqual(daily, [
      { day: "2026-08-10", impressions: 10, clicks: 0 },
      { day: "2026-08-11", impressions: 20, clicks: 3 },
    ]);
  });
});

describe("viewability + marquee dedupe keys", () => {
  it("uses 50% / 1s thresholds", () => {
    assert.equal(PARTNER_VIEWABILITY_RATIO, 0.5);
    assert.equal(PARTNER_VIEWABILITY_MS, 1000);
  });

  it("logical key ignores DOM loop copy index", () => {
    const a = analyticsLogicalViewKey({
      campaignId: "c1",
      creativeId: "cr1",
      placementKey: "INFOSPOT_HOME_MARQUEE",
    });
    const b = analyticsLogicalViewKey({
      campaignId: "c1",
      creativeId: "cr1",
      placementKey: "INFOSPOT_HOME_MARQUEE",
    });
    assert.equal(a, b);
    assert.equal(a, "c1:cr1:INFOSPOT_HOME_MARQUEE");
  });

  it("extracts tracking key from /r/ href", () => {
    assert.equal(extractTrackingKeyFromHref("/r/vicario-abc"), "vicario-abc");
    assert.equal(
      extractTrackingKeyFromHref("https://infospot.com.ar/r/vicario-abc?x=1"),
      "vicario-abc",
    );
    assert.equal(extractTrackingKeyFromHref("https://example.com/x"), null);
  });
});

describe("institutional policy", () => {
  it("excludes ORGANIZER / CO_ORGANIZER from advertising impressions by default", () => {
    assert.deepEqual([...PARTNER_INSTITUTIONAL_ROLES_NO_ADS], ["ORGANIZER", "CO_ORGANIZER"]);
  });
});

describe("partner analytics CSV", () => {
  it("exports aggregates without raw event dump", () => {
    const csv = partnerAnalyticsCsv({
      partnerId: "p1",
      partnerName: "Vicario",
      range: resolveAnalyticsDateRange({
        period: "today",
        now: new Date("2026-08-11T12:00:00.000Z"),
      }),
      totals: {
        impressions: 10,
        clicks: 1,
        ctrPercent: 10,
        activeCampaigns: 1,
      },
      byApplication: [
        {
          key: "INFO_SPOT",
          label: "InfoSpot",
          impressions: 10,
          clicks: 1,
          ctrPercent: 10,
        },
      ],
      byCampaign: [],
      byPlacement: [],
      byCreative: [],
      byDevice: [],
      daily: [{ day: "2026-08-11", impressions: 10, clicks: 1 }],
      disclaimer: "x",
    });
    assert.match(csv, /totals/);
    assert.match(csv, /INFO_SPOT/);
    assert.doesNotMatch(csv, /eventId|userId|fingerprint|ipAddress/i);
  });
});
