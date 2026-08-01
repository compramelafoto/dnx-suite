import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLICKATON_MEMBER_STORY_V1,
  CLICKATON_WELCOME_STORY_V1,
  getClickatonParticipantCardPreset,
  instantiatePresetPayload,
  normalizeParticipantCardType,
} from "../participant-card-presets";

describe("normalizeParticipantCardType", () => {
  it("accepts lowercase and uppercase aliases", () => {
    assert.equal(normalizeParticipantCardType("welcome"), "welcome");
    assert.equal(normalizeParticipantCardType("WELCOME"), "welcome");
    assert.equal(normalizeParticipantCardType("member"), "member");
    assert.equal(normalizeParticipantCardType("MEMBER"), "member");
  });

  it("rejects unknown card types", () => {
    assert.throws(() => normalizeParticipantCardType("OTHER" as "welcome"));
  });
});

describe("getClickatonParticipantCardPreset", () => {
  it("returns welcome preset for welcome", () => {
    const preset = getClickatonParticipantCardPreset("welcome");
    assert.equal(preset.presetId, CLICKATON_WELCOME_STORY_V1.presetId);
    assert.equal(preset.meta.templateKey, "CLICKATON_WELCOME_STORY_V1");
  });

  it("returns member preset for member", () => {
    const preset = getClickatonParticipantCardPreset("member");
    assert.equal(preset.presetId, CLICKATON_MEMBER_STORY_V1.presetId);
    assert.equal(preset.meta.templateKey, "CLICKATON_MEMBER_STORY_V1");
  });
});

describe("instantiatePresetPayload", () => {
  it("clones blocks with new ids without mutating source", () => {
    const beforeIds = CLICKATON_WELCOME_STORY_V1.payload.blocks.map((b) => b.id);
    const payload = instantiatePresetPayload(CLICKATON_WELCOME_STORY_V1);
    const afterIds = CLICKATON_WELCOME_STORY_V1.payload.blocks.map((b) => b.id);
    assert.deepEqual(beforeIds, afterIds);
    assert.notDeepEqual(
      payload.blocks.map((b) => b.id),
      beforeIds
    );
    assert.equal(payload.meta.instantiatedFromPreset, true);
    assert.equal(payload.canvas.width, 1080);
    assert.equal(payload.canvas.height, 1920);
  });
});
