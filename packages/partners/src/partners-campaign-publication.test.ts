import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertSnapshotReadyForPublish,
  computeCampaignPublicationContentHash,
  PARTNER_PUBLICATION_EXCLUDED_FIELDS,
  resolvePublicationDatabaseKey,
  resolvePublicationFreshness,
  type PartnerCampaignPublicationSnapshot,
} from "./campaign-publication";

function baseSnapshot(
  overrides: Partial<PartnerCampaignPublicationSnapshot> = {},
): PartnerCampaignPublicationSnapshot {
  const campaignId = "camp_1";
  const partnerId = "partner_1";
  const assetId = "asset_1";
  return {
    partner: {
      id: partnerId,
      name: "Vicario",
      legalName: null,
      slug: "vicario",
      description: null,
      type: "COMPANY",
      status: "ACTIVE",
      logoUrl: "https://cdn.example/logo.png",
      websiteUrl: "https://vicariodigital.com",
      instagram: null,
      facebookUrl: null,
      linkedinUrl: null,
      city: "Rosario",
      provinceOrState: "Santa Fe",
      country: "AR",
      archivedAt: null,
    },
    campaign: {
      id: campaignId,
      partnerId,
      name: "Vicario marquee",
      description: null,
      status: "ACTIVE",
      startsAt: null,
      endsAt: null,
      priority: 100,
      destinationUrl: "https://vicariodigital.com",
      trackingEnabled: true,
      geoScope: "GLOBAL",
      archivedAt: null,
    },
    creatives: [
      {
        id: "cr_1",
        campaignId,
        assetId,
        format: "LOGO_MARQUEE",
        deviceTarget: "ALL",
        title: null,
        body: null,
        ctaText: null,
        destinationUrl: null,
        status: "APPROVED",
        startsAt: null,
        endsAt: null,
        sortOrder: 100,
        archivedAt: null,
      },
    ],
    assets: [
      {
        id: assetId,
        partnerId,
        type: "LOGO_PRIMARY",
        name: "Logo",
        description: null,
        storageProvider: "R2",
        storageKey: "k",
        fileUrl: "https://cdn.example/logo.png",
        mimeType: "image/png",
        fileExtension: "png",
        fileSize: 100,
        width: 200,
        height: 80,
        aspectRatio: null,
        backgroundType: "UNKNOWN",
        isPrimary: true,
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        altText: null,
        archivedAt: null,
      },
    ],
    geoTargets: [],
    contextTargets: ["PHOTOGRAPHY"],
    placementBindings: [
      {
        id: "bind_1",
        placementKey: "INFOSPOT_HOME_MARQUEE",
        priority: 100,
        isActive: true,
        trackingPlacement: "LOGO_MARQUEE",
        rotationMode: "MARQUEE",
        maxItems: 12,
      },
    ],
    outboundLinks: [
      {
        id: "out_1",
        trackingKey: "vicario-test",
        application: "INFO_SPOT",
        placement: "LOGO_MARQUEE",
        destinationUrl: "https://vicariodigital.com",
        utmSource: "infospot",
        utmMedium: "partner",
        utmCampaign: "logo",
        utmContent: null,
        status: "ACTIVE",
        startsAt: null,
        endsAt: null,
        archivedAt: null,
      },
    ],
    ...overrides,
  };
}

describe("campaign publication domain", () => {
  it("maps apps to DB keys", () => {
    assert.equal(resolvePublicationDatabaseKey("INFO_SPOT"), "INFOSPOT");
    assert.equal(resolvePublicationDatabaseKey("COMPRAME_LA_FOTO"), "CLF");
    assert.equal(resolvePublicationDatabaseKey("CLICKATON"), null);
  });

  it("contentHash estable e idempotente", () => {
    const a = computeCampaignPublicationContentHash(baseSnapshot());
    const b = computeCampaignPublicationContentHash(baseSnapshot());
    assert.equal(a, b);
    assert.equal(a.length, 40);
  });

  it("contentHash cambia si muta creative", () => {
    const a = computeCampaignPublicationContentHash(baseSnapshot());
    const mutated = baseSnapshot();
    mutated.creatives[0]!.title = "Promo";
    const b = computeCampaignPublicationContentHash(mutated);
    assert.notEqual(a, b);
  });

  it("freshness UP_TO_DATE / OUTDATED / FAILED", () => {
    assert.equal(
      resolvePublicationFreshness({
        status: "SYNCED",
        sourceVersion: "abc",
        targetVersion: "abc",
      }),
      "UP_TO_DATE",
    );
    assert.equal(
      resolvePublicationFreshness({
        status: "SYNCED",
        sourceVersion: "abc",
        targetVersion: "zzz",
      }),
      "OUTDATED",
    );
    assert.equal(
      resolvePublicationFreshness({ status: "FAILED", sourceVersion: "abc" }),
      "FAILED",
    );
  });

  it("assertSnapshotReadyForPublish valida creative/asset/destination", () => {
    assert.doesNotThrow(() => assertSnapshotReadyForPublish(baseSnapshot()));
    assert.throws(() =>
      assertSnapshotReadyForPublish(
        baseSnapshot({
          creatives: [
            {
              ...baseSnapshot().creatives[0]!,
              status: "DRAFT",
            },
          ],
        }),
      ),
    );
  });

  it("excluye campos privados del contrato", () => {
    assert.ok(PARTNER_PUBLICATION_EXCLUDED_FIELDS.includes("notes"));
    assert.ok(PARTNER_PUBLICATION_EXCLUDED_FIELDS.includes("email"));
    assert.ok(PARTNER_PUBLICATION_EXCLUDED_FIELDS.includes("taxId"));
    assert.ok(PARTNER_PUBLICATION_EXCLUDED_FIELDS.includes("contacts"));
  });

  it("multi-target keys independientes", () => {
    const apps = ["INFO_SPOT", "COMPRAME_LA_FOTO"] as const;
    const keys = apps.map((a) => resolvePublicationDatabaseKey(a));
    assert.deepEqual(keys, ["INFOSPOT", "CLF"]);
  });
});
