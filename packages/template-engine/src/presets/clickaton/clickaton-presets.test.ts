import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLICKATON_MEMBER_STORY_V1,
  CLICKATON_WELCOME_STORY_V1,
  getClickatonTemplatePreset,
  instantiateClickatonTemplatePreset,
  listClickatonTemplatePresets,
} from "./index";

describe("clickaton-presets package", () => {
  it("lista y obtiene presets oficiales", () => {
    const list = listClickatonTemplatePresets();
    assert.equal(list.length, 2);
    assert.ok(getClickatonTemplatePreset("CLICKATON_WELCOME_STORY_V1"));
    assert.ok(getClickatonTemplatePreset("clickaton-member-story-v1"));
  });

  it("welcome y member son 1080×1920", () => {
    assert.equal(CLICKATON_WELCOME_STORY_V1.payload.canvas.width, 1080);
    assert.equal(CLICKATON_WELCOME_STORY_V1.payload.canvas.height, 1920);
    assert.equal(CLICKATON_MEMBER_STORY_V1.payload.canvas.width, 1080);
    assert.equal(CLICKATON_MEMBER_STORY_V1.payload.canvas.height, 1920);
  });

  it("instantiate no muta original y regenera IDs", () => {
    const before = CLICKATON_WELCOME_STORY_V1.payload.blocks.map((b) => b.id);
    const a = instantiateClickatonTemplatePreset(CLICKATON_WELCOME_STORY_V1);
    const b = instantiateClickatonTemplatePreset(CLICKATON_WELCOME_STORY_V1);
    const after = CLICKATON_WELCOME_STORY_V1.payload.blocks.map((x) => x.id);
    assert.deepEqual(before, after);
    assert.notEqual(a.blocks[0]?.id, before[0]);
    assert.notEqual(a.blocks[0]?.id, b.blocks[0]?.id);
  });
});
