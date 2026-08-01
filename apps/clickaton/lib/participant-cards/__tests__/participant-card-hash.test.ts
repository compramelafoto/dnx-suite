import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildClickatonParticipantTemplateData } from "../participant-card-data";
import {
  computeClickatonParticipantCardRenderHash,
  normalizeTemplateDocumentForHash,
  renderHashPrefix,
} from "../participant-card-hash";
import { getClickatonParticipantCardPreset } from "../participant-card-presets";
import { mockParticipantCardRegistration } from "./participant-card-test-fixtures";

describe("computeClickatonParticipantCardRenderHash", () => {
  it("is stable for identical inputs", () => {
    const registration = mockParticipantCardRegistration();
    const preset = getClickatonParticipantCardPreset("welcome");
    const templateData = buildClickatonParticipantTemplateData({
      registration,
      photoDataUrl: "data:image/png;base64,abc",
    });
    const input = {
      cardType: "welcome" as const,
      preset,
      registration,
      templateData,
      photoAssetId: "photo_asset_001",
      photoContentHash: "abc123",
    };
    const a = computeClickatonParticipantCardRenderHash(input);
    const b = computeClickatonParticipantCardRenderHash(input);
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  it("changes when participant name changes", () => {
    const base = mockParticipantCardRegistration();
    const preset = getClickatonParticipantCardPreset("welcome");
    const hash = (reg: typeof base) =>
      computeClickatonParticipantCardRenderHash({
        cardType: "welcome",
        preset,
        registration: reg,
        templateData: buildClickatonParticipantTemplateData({
          registration: reg,
          photoDataUrl: "data:image/png;base64,abc",
        }),
        photoAssetId: reg.profilePhotoAssetId,
        photoContentHash: "abc123",
      });
    const h1 = hash(base);
    const h2 = hash({ ...base, firstName: "María" });
    assert.notEqual(h1, h2);
  });

  it("changes with forceGenerationId", () => {
    const registration = mockParticipantCardRegistration();
    const preset = getClickatonParticipantCardPreset("welcome");
    const templateData = buildClickatonParticipantTemplateData({
      registration,
      photoDataUrl: "data:image/png;base64,abc",
    });
    const base = {
      cardType: "welcome" as const,
      preset,
      registration,
      templateData,
      photoAssetId: "photo_asset_001",
      photoContentHash: "abc123",
    };
    const h1 = computeClickatonParticipantCardRenderHash(base);
    const h2 = computeClickatonParticipantCardRenderHash({
      ...base,
      forceGenerationId: "force-1",
    });
    assert.notEqual(h1, h2);
  });

  it("normalizes instagram consistently", () => {
    const registration = mockParticipantCardRegistration({
      instagramHandle: "@Ana_Foto",
      instagramHandleNormalized: null,
    });
    const preset = getClickatonParticipantCardPreset("member");
    const templateData = buildClickatonParticipantTemplateData({
      registration,
      photoDataUrl: "data:image/png;base64,abc",
    });
    const hash = computeClickatonParticipantCardRenderHash({
      cardType: "member",
      preset,
      registration,
      templateData,
      photoAssetId: null,
      photoContentHash: null,
    });
    assert.ok(hash);
  });
});

describe("normalizeTemplateDocumentForHash", () => {
  it("orders blocks by name and excludes ephemeral ids", () => {
    const preset = getClickatonParticipantCardPreset("welcome");
    const normalized = normalizeTemplateDocumentForHash(preset);
    assert.equal(normalized.canvas.width, 1080);
    assert.ok(normalized.blocks.length > 0);
    for (const block of normalized.blocks) {
      assert.ok(block.name);
      assert.ok(block.type);
      assert.equal("id" in block, false);
    }
    const names = normalized.blocks.map((b) => b.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(names, sorted);
  });
});

describe("renderHashPrefix", () => {
  it("returns first 12 hex chars", () => {
    const hash = "abcdef0123456789".repeat(4);
    assert.equal(renderHashPrefix(hash), hash.slice(0, 12));
  });
});
