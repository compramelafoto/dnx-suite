import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCampaignScheduleActive,
  isCreativeEligible,
  isClfPartnerAdsEnabled,
  isInfospotPartnerAdsEnabled,
  matchesCampaignContext,
  matchesCampaignGeo,
  matchesCreativeDevice,
  resolveEligibleAds,
  AD_PLACEMENT_CATALOG,
  FOTOFFICE_AD_PLACEMENT_KEYS,
  type ResolveAdsCandidate,
} from "./campaigns";

function candidate(
  partial: Partial<ResolveAdsCandidate> &
    Pick<ResolveAdsCandidate, "campaignId" | "creative">,
): ResolveAdsCandidate {
  return {
    campaignName: "Camp",
    partnerId: "p1",
    partnerName: "Partner",
    partnerArchived: false,
    campaignStatus: "ACTIVE",
    campaignStartsAt: null,
    campaignEndsAt: null,
    campaignArchivedAt: null,
    campaignPriority: 100,
    geoScope: "GLOBAL",
    geoTargets: [],
    contextTargets: [],
    placementPriority: 100,
    trackingPlacement: "BANNER",
    allowedFormats: ["BANNER_HORIZONTAL", "BANNER_MOBILE", "CARD_PROMO", "WELCOME_INTERSTITIAL"],
    ...partial,
  };
}

describe("campaign schedule", () => {
  it("rejects draft/paused/expired/future", () => {
    assert.equal(
      isCampaignScheduleActive({ status: "DRAFT" }),
      false,
    );
    assert.equal(
      isCampaignScheduleActive({ status: "PAUSED" }),
      false,
    );
    const now = new Date("2026-08-10T12:00:00Z");
    assert.equal(
      isCampaignScheduleActive({
        status: "ACTIVE",
        endsAt: new Date("2026-08-01T00:00:00Z"),
        now,
      }),
      false,
    );
    assert.equal(
      isCampaignScheduleActive({
        status: "ACTIVE",
        startsAt: new Date("2026-09-01T00:00:00Z"),
        now,
      }),
      false,
    );
    assert.equal(
      isCampaignScheduleActive({ status: "ACTIVE", now }),
      true,
    );
  });
});

describe("creative eligibility", () => {
  it("requires APPROVED + asset approved", () => {
    assert.equal(
      isCreativeEligible({ status: "PENDING_APPROVAL", assetApproved: true }),
      false,
    );
    assert.equal(
      isCreativeEligible({ status: "APPROVED", assetApproved: false }),
      false,
    );
    assert.equal(
      isCreativeEligible({ status: "APPROVED", assetApproved: true }),
      true,
    );
  });
});

describe("geo targeting", () => {
  it("matches Rosario include and GLOBAL", () => {
    assert.equal(
      matchesCampaignGeo({
        geoScope: "GLOBAL",
        targets: [],
        audience: { city: "Rosario" },
      }),
      true,
    );
    assert.equal(
      matchesCampaignGeo({
        geoScope: "CITY",
        targets: [
          { countryCode: "AR", province: "Santa Fe", city: "Rosario", include: true },
        ],
        audience: { countryCode: "AR", province: "Santa Fe", city: "Rosario" },
      }),
      true,
    );
    assert.equal(
      matchesCampaignGeo({
        geoScope: "CITY",
        targets: [
          { countryCode: "AR", province: "Santa Fe", city: "Rosario", include: true },
        ],
        audience: { countryCode: "AR", province: "Santa Fe", city: "Rafaela" },
      }),
      false,
    );
  });
});

describe("context + device", () => {
  it("filters by category and device", () => {
    assert.equal(
      matchesCampaignContext({
        targets: ["SPORTS"],
        audienceCategories: ["SPORTS", "EVENT"],
      }),
      true,
    );
    assert.equal(
      matchesCampaignContext({
        targets: ["XV"],
        audienceCategories: ["SPORTS"],
      }),
      false,
    );
    assert.equal(matchesCreativeDevice("MOBILE", "DESKTOP"), false);
    assert.equal(matchesCreativeDevice("MOBILE", "MOBILE"), true);
    assert.equal(matchesCreativeDevice("ALL", "DESKTOP"), true);
  });
});

describe("resolveEligibleAds", () => {
  it("picks approved desktop creative and respects maxItems", () => {
    const ads = resolveEligibleAds({
      device: "DESKTOP",
      maxItems: 1,
      rotationMode: "STATIC",
      candidates: [
        candidate({
          campaignId: "c1",
          creative: {
            id: "cr1",
            format: "BANNER_HORIZONTAL",
            deviceTarget: "DESKTOP",
            title: "A",
            body: null,
            ctaText: "Ver",
            status: "APPROVED",
            startsAt: null,
            endsAt: null,
            archivedAt: null,
            sortOrder: 10,
            imageUrl: "/a.png",
            href: "/r/key-a",
            assetApproved: true,
          },
        }),
        candidate({
          campaignId: "c2",
          creative: {
            id: "cr2",
            format: "BANNER_MOBILE",
            deviceTarget: "MOBILE",
            title: "B",
            body: null,
            ctaText: null,
            status: "APPROVED",
            startsAt: null,
            endsAt: null,
            archivedAt: null,
            sortOrder: 20,
            imageUrl: "/b.png",
            href: null,
            assetApproved: true,
          },
        }),
      ],
    });
    assert.equal(ads.length, 1);
    assert.equal(ads[0]?.creativeId, "cr1");
    assert.equal(ads[0]?.href, "/r/key-a");
  });
});

describe("kill switches default OFF", () => {
  it("infospot and clf ads disabled unless truthy", () => {
    const prevI = process.env.INFOSPOT_PARTNER_ADS_ENABLED;
    const prevC = process.env.CLF_PARTNER_ADS_ENABLED;
    delete process.env.INFOSPOT_PARTNER_ADS_ENABLED;
    delete process.env.CLF_PARTNER_ADS_ENABLED;
    assert.equal(isInfospotPartnerAdsEnabled(), false);
    assert.equal(isClfPartnerAdsEnabled(), false);
    process.env.INFOSPOT_PARTNER_ADS_ENABLED = "true";
    process.env.CLF_PARTNER_ADS_ENABLED = "1";
    assert.equal(isInfospotPartnerAdsEnabled(), true);
    assert.equal(isClfPartnerAdsEnabled(), true);
    if (prevI === undefined) delete process.env.INFOSPOT_PARTNER_ADS_ENABLED;
    else process.env.INFOSPOT_PARTNER_ADS_ENABLED = prevI;
    if (prevC === undefined) delete process.env.CLF_PARTNER_ADS_ENABLED;
    else process.env.CLF_PARTNER_ADS_ENABLED = prevC;
  });
});

describe("espacios de FotoOffice en el catálogo", () => {
  it("declara las cinco claves del workspace", () => {
    assert.deepEqual([...FOTOFFICE_AD_PLACEMENT_KEYS], [
      "FOTOFFICE_PORTAL_BANNER",
      "FOTOFFICE_BENEFITS_MARQUEE",
      "FOTOFFICE_BENEFIT_CARD",
      "FOTOFFICE_RAFFLE_SPONSOR",
      "FOTOFFICE_PUBLIC_MARQUEE",
    ]);
  });

  it("cada clave tiene su entrada en el catálogo, bajo FOTO_OFFICE", () => {
    for (const key of FOTOFFICE_AD_PLACEMENT_KEYS) {
      const entry = AD_PLACEMENT_CATALOG.find((e) => e.placementKey === key);
      assert.ok(entry, `falta la entrada de ${key}`);
      assert.equal(entry.application, "FOTO_OFFICE");
    }
  });

  it("ninguno viene encendido por defecto", () => {
    for (const key of FOTOFFICE_AD_PLACEMENT_KEYS) {
      const entry = AD_PLACEMENT_CATALOG.find((e) => e.placementKey === key);
      assert.equal(entry?.isActiveDefault, false);
    }
  });

  it("el catálogo pasa a tener veintinueve espacios", () => {
    assert.equal(AD_PLACEMENT_CATALOG.length, 29);
  });
});
