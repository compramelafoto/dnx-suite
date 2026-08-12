import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOUNTED_WELCOME_PLACEMENT_KEYS,
  UNMOUNTED_WELCOME_PLACEMENT_KEYS,
  assertWelcomeAdminScopeConfig,
  assertWelcomeParticipationMatchesScope,
  assertWelcomePlacementPublishable,
  getWelcomeRuntimeFlagSnapshot,
  isMountedWelcomePlacementKey,
  listSelectableWelcomePlacementsForAdmin,
  listWelcomePlacementsForAdminUi,
  validateWelcomeCampaignBeforePublish,
  welcomeAdminCatalogMeta,
} from "./welcome-admin";
import { PartnersDomainError } from "./types";

describe("welcome admin catalog", () => {
  it("solo plataformas autorizadas; FotoOffice ausente", () => {
    const all = listWelcomePlacementsForAdminUi();
    assert.ok(all.every((p) => (p.application as string) !== "FOTO_OFFICE"));
    const apps = new Set(all.map((p) => p.application));
    for (const a of ["CLICKATON", "FOTO_RANK", "INFO_SPOT", "COMPRAME_LA_FOTO"] as const) {
      assert.ok(apps.has(a), a);
    }
  });

  it("placements montados habilitados; HOME no montados deshabilitados", () => {
    const all = listWelcomePlacementsForAdminUi();
    for (const key of MOUNTED_WELCOME_PLACEMENT_KEYS) {
      const row = all.find((p) => p.placementKey === key);
      assert.ok(row, key);
      assert.equal(row!.selectable, true);
      assert.equal(row!.mounted, true);
    }
    for (const key of UNMOUNTED_WELCOME_PLACEMENT_KEYS) {
      const row = all.find((p) => p.placementKey === key);
      assert.ok(row, key);
      assert.equal(row!.selectable, false);
      assert.match(row!.disabledReason ?? "", /todavía no habilitada/i);
    }
    const selectable = listSelectableWelcomePlacementsForAdmin();
    assert.ok(selectable.every((p) => p.selectable));
    assert.ok(!selectable.some((p) => p.placementKey.includes("HOME_WELCOME") && p.application !== "INFO_SPOT"));
  });

  it("meta de formato visible", () => {
    const meta = welcomeAdminCatalogMeta();
    assert.equal(meta.format, "WELCOME_INTERSTITIAL");
    assert.match(meta.formatLabel, /Activación destacada/i);
    assert.equal(meta.frequencyHours, 24);
  });
});

describe("welcome admin scope", () => {
  it("global/plataforma sin ID; contextual exige ID y app correcta", () => {
    assert.doesNotThrow(() =>
      assertWelcomeAdminScopeConfig({
        scopeKind: "GLOBAL",
        application: "CLICKATON",
      }),
    );
    assert.throws(
      () =>
        assertWelcomeAdminScopeConfig({
          scopeKind: "GLOBAL",
          application: "CLICKATON",
          contextId: "x",
        }),
      PartnersDomainError,
    );
    assert.throws(
      () =>
        assertWelcomeAdminScopeConfig({
          scopeKind: "CONTEST",
          application: "CLICKATON",
          contextId: "c1",
        }),
      PartnersDomainError,
    );
    assert.doesNotThrow(() =>
      assertWelcomeAdminScopeConfig({
        scopeKind: "CONTEST",
        application: "FOTO_RANK",
        contextId: "contest-1",
      }),
    );
    assert.doesNotThrow(() =>
      assertWelcomeAdminScopeConfig({
        scopeKind: "ALBUM",
        application: "COMPRAME_LA_FOTO",
        contextId: "42",
      }),
    );
    assert.throws(
      () =>
        assertWelcomeAdminScopeConfig({
          scopeKind: "EDITION",
          application: "CLICKATON",
        }),
      PartnersDomainError,
    );
  });

  it("huérfana (null participation) rechazada para global y contextual", () => {
    assert.throws(
      () =>
        assertWelcomeParticipationMatchesScope({
          scopeKind: "GLOBAL",
          application: "FOTO_RANK",
          participation: null,
        }),
      /explícita|huérfana/i,
    );
    assert.throws(
      () =>
        assertWelcomeParticipationMatchesScope({
          scopeKind: "ALBUM",
          application: "COMPRAME_LA_FOTO",
          participation: null,
          contextId: "1",
        }),
      PartnersDomainError,
    );
  });

  it("participación GLOBAL explícita aceptada", () => {
    assert.doesNotThrow(() =>
      assertWelcomeParticipationMatchesScope({
        scopeKind: "GLOBAL",
        application: "INFO_SPOT",
        participation: {
          application: "INFO_SPOT",
          contextType: "GLOBAL",
          contextId: null,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
    );
  });
});

describe("welcome admin publishability", () => {
  it("rechaza unmounted; acepta montados", () => {
    assert.throws(
      () => assertWelcomePlacementPublishable("CLICKATON", "CLICKATON_HOME_WELCOME"),
      /runtime montado/i,
    );
    assert.doesNotThrow(() =>
      assertWelcomePlacementPublishable("CLICKATON", "CLICKATON_EVENT_WELCOME"),
    );
    assert.ok(isMountedWelcomePlacementKey("CLF_ALBUM_WELCOME"));
  });

  it("pre-publish acumula errores y warning de flag OFF", () => {
    const issues = validateWelcomeCampaignBeforePublish({
      partnerStatus: "ACTIVE",
      campaignStatus: "DRAFT",
      application: "CLICKATON",
      placementKeys: ["CLICKATON_EVENT_WELCOME"],
      hasApprovedCreative: true,
      hasApprovedAssetWithUrl: true,
      welcomeAsset: {
        partnerId: "p1",
        assetPartnerId: "p1",
        approvalStatus: "APPROVED",
        status: "ACTIVE",
        archivedAt: null,
        fileUrl: "https://cdn.example/w.png",
        altText: "alt",
        mimeType: "image/png",
      },
      destinationUrl: "https://example.com",
      scopeKind: "EDITION",
      contextId: "clxxxxxxxxxxxxxxxxxxx01",
      participation: {
        application: "CLICKATON",
        contextType: "EDITION",
        contextId: "clxxxxxxxxxxxxxxxxxxx01",
        status: "ACTIVE",
        archivedAt: null,
        publicVisibility: "PUBLIC",
      },
    });
    // flags default OFF → warning
    assert.ok(issues.some((i) => i.code === "FLAG_OFF" && i.severity === "warning"));
    assert.ok(!issues.some((i) => i.severity === "error"));
  });

  it("FotoOffice y URL insegura son error", () => {
    const fo = validateWelcomeCampaignBeforePublish({
      partnerStatus: "ACTIVE",
      campaignStatus: "ACTIVE",
      application: "FOTO_OFFICE",
      placementKeys: [],
      hasApprovedCreative: false,
      hasApprovedAssetWithUrl: false,
      destinationUrl: "javascript:alert(1)",
      scopeKind: "GLOBAL",
      participation: null,
    });
    assert.ok(fo.some((i) => i.code === "FOTO_OFFICE"));

    const bad = validateWelcomeCampaignBeforePublish({
      partnerStatus: "ACTIVE",
      campaignStatus: "ACTIVE",
      application: "INFO_SPOT",
      placementKeys: ["INFOSPOT_HOME_WELCOME"],
      hasApprovedCreative: false,
      hasApprovedAssetWithUrl: false,
      destinationUrl: "javascript:alert(1)",
      scopeKind: "GLOBAL",
      participation: {
        application: "INFO_SPOT",
        contextType: "GLOBAL",
        contextId: null,
        status: "ACTIVE",
        archivedAt: null,
      },
    });
    assert.ok(bad.some((i) => i.code === "CREATIVE"));
    assert.ok(bad.some((i) => i.code === "DESTINATION" || i.code === "DESTINATION_UNSAFE"));
  });

  it("flags snapshot default OFF", () => {
    const snap = getWelcomeRuntimeFlagSnapshot();
    assert.ok(snap.length >= 4);
    assert.ok(snap.every((r) => typeof r.enabled === "boolean"));
  });
});
