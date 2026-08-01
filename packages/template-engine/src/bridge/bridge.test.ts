import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromLegacyTemplateV2 } from "./from-legacy-v2";
import { toLegacyTemplateV2 } from "./to-legacy-v2";
import { parseTemplateDocument } from "../schema/parse";
import { SCHOOL_FOLDER_MINIMAL_LEGACY_FIXTURE } from "../testing/fixtures/school-folder-minimal";

describe("legacy Template V2 bridge", () => {
  it("legacy → core", () => {
    const { document, warnings } = fromLegacyTemplateV2(SCHOOL_FOLDER_MINIMAL_LEGACY_FIXTURE, {
      id: "tpl-fixture-1",
      name: "Fixture escolar",
    });
    assert.equal(document.schemaVersion, 1);
    assert.equal(document.width, 3000);
    assert.equal(document.height, 2000);
    assert.equal(document.unit, "px");
    assert.equal(document.blocks.length, 5);
    assert.equal(document.bindings.length, 2);
    assert.equal(document.print?.dpi, 254);
    assert.ok(Array.isArray(warnings));
    const parsed = parseTemplateDocument(document);
    assert.equal(parsed.ok, true);
  });

  it("core → legacy", () => {
    const { document } = fromLegacyTemplateV2(SCHOOL_FOLDER_MINIMAL_LEGACY_FIXTURE);
    const { payload } = toLegacyTemplateV2(document);
    assert.equal(payload.canvas.width, 3000);
    assert.equal(payload.blocks.length, 5);
    assert.equal(payload.variableBindings[0]?.variableKey, "student.fullName");
    assert.equal(payload.blocks[2]?.configJson.variableKey, "student.fullName");
  });

  it("round-trip preserva bloques y bindings", () => {
    const { document } = fromLegacyTemplateV2(SCHOOL_FOLDER_MINIMAL_LEGACY_FIXTURE, {
      name: "RT",
    });
    const { payload } = toLegacyTemplateV2(document);
    const back = fromLegacyTemplateV2(payload, { name: "RT" });
    assert.equal(back.document.blocks.length, document.blocks.length);
    assert.equal(back.document.bindings.length, document.bindings.length);
    assert.deepEqual(
      back.document.blocks.map((b) => b.id),
      document.blocks.map((b) => b.id)
    );
    assert.equal(back.document.metadata?.seedId, document.metadata?.seedId);
  });

  it("preserva metadata desconocida de canvas", () => {
    const legacy = {
      ...SCHOOL_FOLDER_MINIMAL_LEGACY_FIXTURE,
      canvas: {
        ...SCHOOL_FOLDER_MINIMAL_LEGACY_FIXTURE.canvas,
        customFlag: true,
      } as typeof SCHOOL_FOLDER_MINIMAL_LEGACY_FIXTURE.canvas & { customFlag: boolean },
    };
    const { document, warnings } = fromLegacyTemplateV2(legacy);
    assert.ok(warnings.some((w) => w.code === "unmapped_canvas_field"));
    assert.equal(document.metadata?.["canvas.customFlag"], true);
    const { payload } = toLegacyTemplateV2(document);
    assert.equal((payload.canvas as Record<string, unknown>).customFlag, true);
  });
});
