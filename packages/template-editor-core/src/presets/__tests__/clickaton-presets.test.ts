import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getTemplatePreset,
  listTemplatePresets,
  validateTemplatePreset,
} from "@/lib/template-v2/presets/registry";
import { instantiatePresetPayload } from "@/lib/template-v2/presets/preset-helpers";
import { validateLegacyTemplatePayload } from "@/lib/template-v2/services/template-v2-validation-service";
import { parseTemplateV2EditorPayload } from "@/lib/template-v2/validate-save-payload";

describe("clickaton presets", () => {
  it("lista y obtiene presets Clickatón", () => {
    const list = listTemplatePresets({ product: "clickaton" });
    assert.equal(list.length, 2);
    assert.ok(getTemplatePreset("CLICKATON_WELCOME_STORY_V1"));
    assert.ok(getTemplatePreset("clickaton-member-story-v1"));
  });

  for (const key of [
    "CLICKATON_WELCOME_STORY_V1",
    "CLICKATON_MEMBER_STORY_V1",
  ] as const) {
    it(`${key} válido 1080×1920 sin bindings escolares`, () => {
      const preset = getTemplatePreset(key)!;
      assert.equal(preset.payload.canvas.width, 1080);
      assert.equal(preset.payload.canvas.height, 1920);
      assert.equal(preset.meta.product, "clickaton");
      assert.equal(preset.meta.official, true);

      const v = validateTemplatePreset(preset);
      assert.equal(v.valid, true, v.errors.join("; "));

      const parsed = parseTemplateV2EditorPayload(preset.payload);
      assert.equal(parsed.ok, true);

      const validation = validateLegacyTemplatePayload(preset.payload, {
        name: preset.name,
      });
      assert.equal(validation.valid, true, JSON.stringify(validation.errors));

      const ids = preset.payload.blocks.map((b) => b.id);
      assert.equal(new Set(ids).size, ids.length);

      const blob = JSON.stringify(preset.payload);
      assert.ok(!blob.includes("student."));
      assert.ok(!blob.includes("school.name"));
      assert.ok(!blob.includes("buyer."));
      assert.ok(!blob.includes("order."));
    });
  }

  it("instantiatePresetPayload regenera IDs y no muta original", () => {
    const preset = getTemplatePreset("clickaton-welcome-story-v1")!;
    const originalFirst = preset.payload.blocks[0]!.id;
    const a = instantiatePresetPayload(preset);
    const b = instantiatePresetPayload(preset);
    assert.notEqual(a.blocks[0]!.id, originalFirst);
    assert.notEqual(a.blocks[0]!.id, b.blocks[0]!.id);
    assert.equal(preset.payload.blocks[0]!.id, originalFirst);
    assert.equal(a.meta.product, "clickaton");
    assert.equal(a.meta.instantiatedFromPreset, true);
  });
});
