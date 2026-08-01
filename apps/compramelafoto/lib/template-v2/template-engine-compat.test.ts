import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertLegacyTemplateV2EngineCompat,
  createSchoolTemplateEngineRegistry,
  parseTemplateBinding,
  resolveSchoolTemplateDocument,
} from "./template-engine-compat";

/**
 * Smoke de integración P0-02: el package se importa y el bridge funciona.
 * No toca Prisma, R2 ni el editor.
 */
describe("template-engine-compat (CLF)", () => {
  it("parsea alias escolar vía package compartido", () => {
    const parsed = parseTemplateBinding("{alumno}");
    assert.equal(parsed.ok, true);
  });

  it("round-trip legacy mínimo", () => {
    const payload = {
      canvas: { width: 1000, height: 800, dpi: 300 },
      blocks: [
        {
          id: "t1",
          type: "TEXT" as const,
          layout: {
            x: 10,
            y: 10,
            width: 200,
            height: 40,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            visible: true,
          },
          configJson: { content: "{alumno}", fontFamily: "Inter", fontSize: 20 },
        },
      ],
      variableBindings: [],
      meta: { name: "compat-smoke" },
    };
    const result = assertLegacyTemplateV2EngineCompat(payload, { name: "compat-smoke" });
    assert.equal(result.ok, true);
    assert.ok(result.document);
    assert.equal(result.document?.blocks.length, 1);
  });

  it("resuelve con registry escolar", () => {
    const registry = createSchoolTemplateEngineRegistry();
    const compat = assertLegacyTemplateV2EngineCompat({
      canvas: { width: 500, height: 500 },
      blocks: [
        {
          id: "v1",
          type: "VARIABLE_TEXT",
          layout: {
            x: 0,
            y: 0,
            width: 100,
            height: 40,
            rotation: 0,
            zIndex: 0,
            opacity: 1,
            visible: true,
          },
          configJson: { variableKey: "student.fullName", fallback: "—" },
        },
      ],
      variableBindings: [],
      meta: {},
    });
    assert.ok(compat.document);
    const resolved = resolveSchoolTemplateDocument(
      compat.document!,
      { "student.fullName": "Test Alumno" },
      registry
    );
    assert.equal(resolved.document.blocks[0]?.config.content, "Test Alumno");
  });
});
