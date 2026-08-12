import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertWelcomeAssetPublishable,
  assertWelcomeCanonicalContextIdFormat,
  validateWelcomeAssetForPublish,
} from "./welcome-asset-context";
import { PartnersDomainError } from "./types";
import { validateWelcomeCampaignBeforePublish } from "./welcome-admin";

const PARTNER = "partner_syn_e7";
const APPROVED_ASSET = {
  partnerId: PARTNER,
  assetPartnerId: PARTNER,
  approvalStatus: "APPROVED",
  status: "ACTIVE",
  archivedAt: null,
  fileUrl: "https://cdn.example/welcome.png",
  altText: "Sponsor test",
  mimeType: "image/png",
};

describe("welcome canonical context IDs", () => {
  it("acepta cuid/uuid y Album.id; rechaza slug y nombre", () => {
    assert.equal(
      assertWelcomeCanonicalContextIdFormat("EDITION", "clxxxxxxxxxxxxxxxxxxx01"),
      "clxxxxxxxxxxxxxxxxxxx01",
    );
    assert.equal(assertWelcomeCanonicalContextIdFormat("ALBUM", "42"), "42");
    assert.throws(
      () => assertWelcomeCanonicalContextIdFormat("CONTEST", "santa-fe-2026"),
      /slug/i,
    );
    assert.throws(
      () => assertWelcomeCanonicalContextIdFormat("EDITION", "Mi Edición"),
      PartnersDomainError,
    );
    assert.throws(() => assertWelcomeCanonicalContextIdFormat("ALBUM", "album-slug"), PartnersDomainError);
  });
});

describe("welcome asset publish hardening", () => {
  it("asset aprobado válido", () => {
    assert.doesNotThrow(() => assertWelcomeAssetPublishable(APPROVED_ASSET));
  });

  it("PENDING / otro sponsor / archivado / alt vacío / SVG rechazados", () => {
    assert.ok(
      validateWelcomeAssetForPublish({ ...APPROVED_ASSET, approvalStatus: "PENDING" }).some(
        (i) => i.code === "ASSET_APPROVAL",
      ),
    );
    assert.ok(
      validateWelcomeAssetForPublish({
        ...APPROVED_ASSET,
        assetPartnerId: "other",
      }).some((i) => i.code === "ASSET_PARTNER"),
    );
    assert.ok(
      validateWelcomeAssetForPublish({
        ...APPROVED_ASSET,
        archivedAt: new Date(),
      }).some((i) => i.code === "ASSET_ARCHIVED"),
    );
    assert.ok(
      validateWelcomeAssetForPublish({ ...APPROVED_ASSET, altText: "  " }).some(
        (i) => i.code === "ASSET_ALT",
      ),
    );
    assert.ok(
      validateWelcomeAssetForPublish({
        ...APPROVED_ASSET,
        fileUrl: "https://cdn.example/x.svg",
      }).some((i) => i.code === "ASSET_SVG"),
    );
  });

  it("preview draft no publica; flag solo URL no alcanza", () => {
    const draft = validateWelcomeAssetForPublish({ ...APPROVED_ASSET, previewDraft: true });
    assert.ok(draft.some((i) => i.code === "PREVIEW_DRAFT"));

    const issues = validateWelcomeCampaignBeforePublish({
      partnerStatus: "ACTIVE",
      campaignStatus: "DRAFT",
      application: "CLICKATON",
      placementKeys: ["CLICKATON_EVENT_WELCOME"],
      hasApprovedCreative: true,
      hasApprovedAssetWithUrl: true,
      welcomeAsset: null,
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
    assert.ok(issues.some((i) => i.code === "ASSET_DETAIL" || i.code === "ASSET"));
  });

  it("pre-publish con asset aprobado y ID canónico OK (+ warning flag)", () => {
    const issues = validateWelcomeCampaignBeforePublish({
      partnerStatus: "ACTIVE",
      campaignStatus: "DRAFT",
      application: "CLICKATON",
      placementKeys: ["CLICKATON_EVENT_WELCOME"],
      hasApprovedCreative: true,
      hasApprovedAssetWithUrl: true,
      welcomeAsset: APPROVED_ASSET,
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
    assert.ok(!issues.some((i) => i.severity === "error"), JSON.stringify(issues));
    assert.ok(issues.some((i) => i.code === "FLAG_OFF"));
  });
});
