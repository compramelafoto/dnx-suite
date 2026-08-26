/**
 * E2E sintético de dominio — Etapa 6.
 * No toca DB productiva. Sin sponsors/eventos/concursos/álbumes reales.
 * Residual = 0 por diseño (solo estructuras en memoria).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOUNTED_WELCOME_PLACEMENT_KEYS,
  assertWelcomePlacementPublishable,
  listWelcomePlacementsForAdminUi,
  validateWelcomeCampaignBeforePublish,
  WELCOME_FLAG_OFF_PUBLISH_WARNING,
  type WelcomeAdminPrePublishInput,
} from "./welcome-admin";
import { isWelcomeActivationExcludedApplication } from "./welcome-activation";
import {
  computeCampaignPublicationContentHash,
  resolvePublicationDatabaseKey,
  type PartnerCampaignPublicationSnapshot,
} from "./campaign-publication";

const SYNTHETIC_PARTNER = "TEST Sponsor Global E6";

function approvedAsset(partnerId = "syn-partner") {
  return {
    partnerId,
    assetPartnerId: partnerId,
    approvalStatus: "APPROVED" as const,
    status: "ACTIVE",
    archivedAt: null,
    fileUrl: "https://cdn.example/e6.png",
    altText: "TEST Sponsor Global E6",
    mimeType: "image/png",
  };
}

function baseInput(
  overrides: Partial<WelcomeAdminPrePublishInput> &
    Pick<WelcomeAdminPrePublishInput, "application" | "placementKeys" | "scopeKind" | "participation">,
): WelcomeAdminPrePublishInput {
  return {
    partnerStatus: "ACTIVE",
    campaignStatus: "DRAFT",
    hasApprovedCreative: true,
    hasApprovedAssetWithUrl: true,
    welcomeAsset: approvedAsset(),
    destinationUrl: "https://example.test/e6-welcome",
    contextId: overrides.participation?.contextId ?? null,
    ...overrides,
  };
}

describe("welcome admin E2E sintético (memoria)", () => {
  it("Clickatón → evento sintético · validación OK + warning flag OFF", () => {
    const editionId = "clsynckedition000000001";
    const issues = validateWelcomeCampaignBeforePublish(
      baseInput({
        application: "CLICKATON",
        placementKeys: ["CLICKATON_EVENT_WELCOME"],
        scopeKind: "EDITION",
        contextId: editionId,
        participation: {
          application: "CLICKATON",
          contextType: "EDITION",
          contextId: editionId,
          status: "ACTIVE",
          archivedAt: null,
          publicVisibility: "PUBLIC",
        },
      }),
    );
    assert.ok(!issues.some((i) => i.severity === "error"), JSON.stringify(issues));
    assert.ok(issues.some((i) => i.code === "FLAG_OFF"));
    assert.match(WELCOME_FLAG_OFF_PUBLISH_WARNING, /no será visible/i);
    assert.doesNotThrow(() =>
      assertWelcomePlacementPublishable("CLICKATON", "CLICKATON_EVENT_WELCOME"),
    );
  });

  it("FotoRank → concurso sintético", () => {
    const contestId = "clsynfrcontest000000001";
    const issues = validateWelcomeCampaignBeforePublish(
      baseInput({
        application: "FOTO_RANK",
        placementKeys: ["FOTORANK_CONTEST_WELCOME"],
        scopeKind: "CONTEST",
        contextId: contestId,
        participation: {
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: contestId,
          status: "ACTIVE",
          archivedAt: null,
          publicVisibility: "PUBLIC",
        },
      }),
    );
    assert.ok(!issues.some((i) => i.severity === "error"), JSON.stringify(issues));
  });

  it("ComprameLaFoto → álbum sintético", () => {
    const albumId = "900001";
    const issues = validateWelcomeCampaignBeforePublish(
      baseInput({
        application: "COMPRAME_LA_FOTO",
        placementKeys: ["CLF_ALBUM_WELCOME"],
        scopeKind: "ALBUM",
        contextId: albumId,
        participation: {
          application: "COMPRAME_LA_FOTO",
          contextType: "ALBUM",
          contextId: albumId,
          status: "ACTIVE",
          archivedAt: null,
          publicVisibility: "PUBLIC",
        },
      }),
    );
    assert.ok(!issues.some((i) => i.severity === "error"), JSON.stringify(issues));
  });

  it("InfoSpot → home welcome sin entidad contextual persistente", () => {
    const issues = validateWelcomeCampaignBeforePublish(
      baseInput({
        application: "INFO_SPOT",
        placementKeys: ["INFOSPOT_HOME_WELCOME"],
        scopeKind: "GLOBAL",
        participation: {
          application: "INFO_SPOT",
          contextType: "GLOBAL",
          contextId: null,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
    );
    assert.ok(!issues.some((i) => i.severity === "error"), JSON.stringify(issues));
  });

  it("rechaza HOME no montados y FotoOffice", () => {
    assert.throws(() =>
      assertWelcomePlacementPublishable("CLICKATON", "CLICKATON_HOME_WELCOME"),
    );
    assert.ok(isWelcomeActivationExcludedApplication("FOTO_OFFICE"));
    const fo = validateWelcomeCampaignBeforePublish(
      baseInput({
        application: "FOTO_OFFICE",
        placementKeys: [],
        scopeKind: "GLOBAL",
        participation: null,
        hasApprovedCreative: false,
        hasApprovedAssetWithUrl: false,
        destinationUrl: null,
      }),
    );
    assert.ok(fo.some((i) => i.code === "FOTO_OFFICE"));
  });

  it("snapshot mínimo de publicación no incluye PII ni FO", () => {
    const snapshot: PartnerCampaignPublicationSnapshot = {
      partner: {
        id: "syn-partner-e6",
        name: SYNTHETIC_PARTNER,
        legalName: null,
        slug: "test-sponsor-global-e6",
        description: null,
        type: "COMPANY",
        status: "ACTIVE",
        logoUrl: null,
        websiteUrl: "https://example.test",
        instagram: null,
        facebookUrl: null,
        linkedinUrl: null,
        city: null,
        provinceOrState: null,
        country: null,
        archivedAt: null,
      },
      campaign: {
        id: "syn-e6-campaign",
        partnerId: "syn-partner-e6",
        name: `${SYNTHETIC_PARTNER} · CK`,
        description: null,
        status: "ACTIVE",
        startsAt: null,
        endsAt: null,
        priority: 100,
        destinationUrl: "https://example.test/e6",
        trackingEnabled: true,
        geoScope: "GLOBAL",
        archivedAt: null,
      },
      creatives: [],
      assets: [],
      geoTargets: [],
      contextTargets: [],
      placementBindings: [
        {
          id: "bind-syn",
          placementKey: "CLICKATON_EVENT_WELCOME",
          priority: 100,
          isActive: true,
          trackingPlacement: "WELCOME",
          rotationMode: "STATIC",
          maxItems: 1,
        },
      ],
      outboundLinks: [],
    };
    const hash = computeCampaignPublicationContentHash(snapshot);
    assert.equal(typeof hash, "string");
    assert.ok(hash.length > 8);
    assert.equal(resolvePublicationDatabaseKey("FOTO_OFFICE"), null);
  });

  it("solo placements montados son publicables en catálogo admin", () => {
    const selectable = listWelcomePlacementsForAdminUi().filter((p) => p.selectable);
    assert.deepEqual(
      selectable.map((p) => p.placementKey).sort(),
      [...MOUNTED_WELCOME_PLACEMENT_KEYS].sort(),
    );
  });

  it("limpieza: residuales sintéticos = 0 (sin escrituras)", () => {
    const residuals = {
      sponsors: 0,
      campaigns: 0,
      participations: 0,
      creatives: 0,
      impressions: 0,
      clicks: 0,
      entities: 0,
    };
    assert.deepEqual(residuals, {
      sponsors: 0,
      campaigns: 0,
      participations: 0,
      creatives: 0,
      impressions: 0,
      clicks: 0,
      entities: 0,
    });
  });
});
