import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertSnapshotReadyForPublish,
  computeCampaignPublicationContentHash,
  PARTNER_PUBLICATION_DATABASE_KEYS,
  PARTNER_PUBLICATION_EXCLUDED_FIELDS,
  PUBLICATION_ENV_BY_DB_KEY,
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
    assert.equal(resolvePublicationDatabaseKey("FOTO_RANK"), "FOTORANK");
    assert.equal(resolvePublicationDatabaseKey("FOTO_OFFICE"), null);
    assert.equal(resolvePublicationDatabaseKey("CLICKATON"), null);
  });

  it("FOTORANK ads env is distinct from welcome context", () => {
    assert.equal(
      PUBLICATION_ENV_BY_DB_KEY.FOTORANK,
      "DNX_PARTNERS_FOTORANK_ADS_DATABASE_URL",
    );
    assert.notEqual(
      PUBLICATION_ENV_BY_DB_KEY.FOTORANK,
      "DNX_PARTNERS_FOTORANK_DATABASE_URL",
    );
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

  it("contentHash incluye participation context", () => {
    const without = computeCampaignPublicationContentHash(baseSnapshot());
    const withPart = computeCampaignPublicationContentHash(
      baseSnapshot({
        participation: {
          id: "part_1",
          partnerId: "partner_1",
          application: "FOTO_RANK",
          contextType: "GLOBAL",
          contextId: null,
          status: "CONFIRMED",
        },
      }),
    );
    assert.notEqual(without, withPart);
    const otherContext = computeCampaignPublicationContentHash(
      baseSnapshot({
        participation: {
          id: "part_1",
          partnerId: "partner_1",
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: "contest_abc",
          status: "CONFIRMED",
        },
      }),
    );
    assert.notEqual(withPart, otherContext);
  });

  it("welcomeMedia opcional no altera hash de campañas sin welcome; con welcome sí", () => {
    const a = computeCampaignPublicationContentHash(baseSnapshot());
    const withNull = baseSnapshot();
    withNull.welcomeMedia = null;
    assert.equal(a, computeCampaignPublicationContentHash(withNull));
    const withMedia = baseSnapshot();
    withMedia.welcomeMedia = {
      imageUrl: "https://cdn.example/desk.png",
      desktop: {
        imageUrl: "https://cdn.example/desk.png",
        mimeType: "image/png",
        width: 1200,
        height: 630,
        alt: "Desk",
        animated: false,
        reducedMotionFallbackUrl: null,
        source: "DEFAULT",
      },
      mobile: null,
      logoFallback: null,
      mediaMinDesktopPx: 768,
    };
    assert.notEqual(a, computeCampaignPublicationContentHash(withMedia));
    const json = JSON.stringify(withMedia.welcomeMedia);
    assert.equal(json.includes("email"), false);
    assert.equal(json.includes("taxId"), false);
    assert.equal(json.includes("notes"), false);
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

  it("assertSnapshot rejects FOTO_OFFICE participation", () => {
    assert.throws(
      () =>
        assertSnapshotReadyForPublish(
          baseSnapshot({
            participation: {
              id: "part_fo",
              partnerId: "partner_1",
              application: "FOTO_OFFICE",
              contextType: "GLOBAL",
              contextId: null,
              status: "CONFIRMED",
            },
          }),
        ),
      /FOTO_OFFICE/,
    );
  });

  it("assertSnapshot rejects CONTEST with empty contextId", () => {
    assert.throws(
      () =>
        assertSnapshotReadyForPublish(
          baseSnapshot({
            participation: {
              id: "part_ct",
              partnerId: "partner_1",
              application: "FOTO_RANK",
              contextType: "CONTEST",
              contextId: "  ",
              status: "CONFIRMED",
            },
          }),
        ),
      /contextId/,
    );
    assert.doesNotThrow(() =>
      assertSnapshotReadyForPublish(
        baseSnapshot({
          participation: {
            id: "part_ct",
            partnerId: "partner_1",
            application: "FOTO_RANK",
            contextType: "CONTEST",
            contextId: "contest_ok",
            status: "CONFIRMED",
          },
        }),
      ),
    );
  });

  it("assertSnapshot rejects cancelled/archived participation", () => {
    assert.throws(() =>
      assertSnapshotReadyForPublish(
        baseSnapshot({
          participation: {
            id: "part_x",
            partnerId: "partner_1",
            application: "FOTO_RANK",
            contextType: "GLOBAL",
            contextId: null,
            status: "CANCELLED",
          },
        }),
      ),
    );
    assert.throws(() =>
      assertSnapshotReadyForPublish(
        baseSnapshot({
          participation: {
            id: "part_x",
            partnerId: "partner_1",
            application: "FOTO_RANK",
            contextType: "GLOBAL",
            contextId: null,
            status: "CONFIRMED",
            archivedAt: new Date(),
          },
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

  it("multi-target keys independientes incluyen FOTORANK", () => {
    const apps = ["INFO_SPOT", "COMPRAME_LA_FOTO", "FOTO_RANK"] as const;
    const keys = apps.map((a) => resolvePublicationDatabaseKey(a));
    assert.deepEqual(keys, ["INFOSPOT", "CLF", "FOTORANK"]);
    assert.ok(PARTNER_PUBLICATION_DATABASE_KEYS.includes("FOTORANK"));
  });
});
