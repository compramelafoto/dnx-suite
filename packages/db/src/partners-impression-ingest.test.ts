import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ingestPartnerImpression } from "./partners-impression-ingest";

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    dnxPartnerOutboundLink: {
      findUnique: async () =>
        "link" in overrides
          ? overrides.link
          : {
              id: "ol1",
              partnerId: "p1",
              application: "INFO_SPOT",
              placement: "LOGO_MARQUEE",
              status: "ACTIVE",
              archivedAt: null,
              startsAt: null,
              endsAt: null,
            },
    },
    dnxPartnerCampaignCreative: {
      findFirst: async () =>
        "creative" in overrides
          ? overrides.creative
          : {
              id: "cr1",
              campaignId: "camp1",
              startsAt: null,
              endsAt: null,
              campaign: {
                id: "camp1",
                partnerId: "p1",
                status: "ACTIVE",
                startsAt: null,
                endsAt: null,
                publishTargets: [{ status: "ACTIVE" }],
              },
            },
    },
    dnxPartnerImpressionEvent: {
      create: async (args: { data: Record<string, unknown> }) => {
        (overrides as { created?: unknown }).created = args.data;
        return args.data;
      },
    },
  } as never;
}

describe("ingestPartnerImpression validation", () => {
  it("tracks valid impression with outbound without PII fields", async () => {
    const bag: { created?: Record<string, unknown> } = {};
    const result = await ingestPartnerImpression(mockPrisma(bag), {
      trackingKey: "vicario-key",
      creativeId: "cr1",
      placementKey: "INFOSPOT_HOME_MARQUEE",
      application: "INFO_SPOT",
      userAgent: "Mozilla/5.0 (Macintosh) Chrome/120",
      clientSeed: "anon",
      viewSessionKey: "camp1:cr1:INFOSPOT_HOME_MARQUEE",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.tracked, true);
    assert.ok(bag.created);
    assert.equal(bag.created!.partnerId, "p1");
    assert.equal(bag.created!.campaignId, "camp1");
    assert.equal(bag.created!.outboundLinkId, "ol1");
    assert.equal(bag.created!.isBot, false);
    assert.equal("ip" in bag.created!, false);
    assert.equal("userAgent" in bag.created!, false);
    assert.equal("userId" in bag.created!, false);
    assert.equal("email" in bag.created!, false);
  });

  it("tracks viewable impression without outbound link", async () => {
    const bag: { created?: Record<string, unknown> } = {};
    const result = await ingestPartnerImpression(mockPrisma(bag), {
      campaignId: "camp1",
      creativeId: "cr1",
      placementKey: "INFOSPOT_HOME_MARQUEE",
      application: "INFO_SPOT",
      userAgent: "Mozilla/5.0 (Macintosh) Chrome/120",
      clientSeed: "anon",
      viewSessionKey: "camp1:cr1:INFOSPOT_HOME_MARQUEE",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.tracked, true);
    assert.ok(bag.created);
    assert.equal(bag.created!.outboundLinkId, null);
    assert.equal(bag.created!.partnerId, "p1");
    assert.equal(bag.created!.campaignId, "camp1");
    assert.equal(bag.created!.creativeId, "cr1");
  });

  it("rejects payload without trackingKey and without campaignId", async () => {
    const result = await ingestPartnerImpression(mockPrisma(), {
      creativeId: "cr1",
      placementKey: "INFOSPOT_HOME_MARQUEE",
      application: "INFO_SPOT",
      userAgent: "Mozilla/5.0",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_payload");
  });

  it("ignores bots", async () => {
    const result = await ingestPartnerImpression(mockPrisma(), {
      trackingKey: "vicario-key",
      creativeId: "cr1",
      placementKey: "INFOSPOT_HOME_MARQUEE",
      application: "INFO_SPOT",
      userAgent: "Googlebot/2.1",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.tracked, false);
      assert.equal(result.reason, "bot");
    }
  });

  it("rejects invalid creative", async () => {
    const result = await ingestPartnerImpression(mockPrisma({ creative: null }), {
      trackingKey: "vicario-key",
      creativeId: "missing",
      placementKey: "INFOSPOT_HOME_MARQUEE",
      application: "INFO_SPOT",
      userAgent: "Mozilla/5.0",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "creative_invalid");
  });

  it("rejects wrong application on outbound link", async () => {
    const result = await ingestPartnerImpression(
      mockPrisma({
        link: {
          id: "ol1",
          partnerId: "p1",
          application: "COMPRAME_LA_FOTO",
          placement: "LOGO_MARQUEE",
          status: "ACTIVE",
          archivedAt: null,
          startsAt: null,
          endsAt: null,
        },
      }),
      {
        trackingKey: "vicario-key",
        creativeId: "cr1",
        placementKey: "INFOSPOT_HOME_MARQUEE",
        application: "INFO_SPOT",
        userAgent: "Mozilla/5.0",
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "wrong_application");
  });

  it("rejects inactive target", async () => {
    const result = await ingestPartnerImpression(
      mockPrisma({
        creative: {
          id: "cr1",
          campaignId: "camp1",
          startsAt: null,
          endsAt: null,
          campaign: {
            id: "camp1",
            partnerId: "p1",
            status: "ACTIVE",
            startsAt: null,
            endsAt: null,
            publishTargets: [{ status: "PAUSED" }],
          },
        },
      }),
      {
        trackingKey: "vicario-key",
        creativeId: "cr1",
        placementKey: "INFOSPOT_HOME_MARQUEE",
        application: "INFO_SPOT",
        userAgent: "Mozilla/5.0",
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "target_paused");
  });

  it("rejects wrong placement key", async () => {
    const result = await ingestPartnerImpression(mockPrisma(), {
      trackingKey: "vicario-key",
      creativeId: "cr1",
      placementKey: "NOT_A_REAL_PLACEMENT",
      application: "INFO_SPOT",
      userAgent: "Mozilla/5.0",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_placement");
  });

  it("rejects FotoOffice", async () => {
    const result = await ingestPartnerImpression(mockPrisma(), {
      campaignId: "camp1",
      creativeId: "cr1",
      placementKey: "INFOSPOT_HOME_MARQUEE",
      application: "FOTO_OFFICE" as never,
      userAgent: "Mozilla/5.0",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "foto_office_excluded");
  });

  it("rejects placement of another application (no outbound)", async () => {
    const result = await ingestPartnerImpression(mockPrisma(), {
      campaignId: "camp1",
      creativeId: "cr1",
      placementKey: "CLF_LOGO_MARQUEE",
      application: "INFO_SPOT",
      userAgent: "Mozilla/5.0",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_placement");
  });

  it("rejects creative/campaign mismatch without outbound", async () => {
    const result = await ingestPartnerImpression(mockPrisma({ creative: null }), {
      campaignId: "other-camp",
      creativeId: "cr1",
      placementKey: "INFOSPOT_HOME_MARQUEE",
      application: "INFO_SPOT",
      userAgent: "Mozilla/5.0",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "creative_invalid");
  });

  it("rejects out of schedule without outbound", async () => {
    const past = new Date("2020-01-01T00:00:00.000Z");
    const result = await ingestPartnerImpression(
      mockPrisma({
        creative: {
          id: "cr1",
          campaignId: "camp1",
          startsAt: null,
          endsAt: past,
          campaign: {
            id: "camp1",
            partnerId: "p1",
            status: "ACTIVE",
            startsAt: null,
            endsAt: null,
            publishTargets: [{ status: "ACTIVE" }],
          },
        },
      }),
      {
        campaignId: "camp1",
        creativeId: "cr1",
        placementKey: "INFOSPOT_HOME_MARQUEE",
        application: "INFO_SPOT",
        userAgent: "Mozilla/5.0",
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "out_of_schedule");
  });
});
