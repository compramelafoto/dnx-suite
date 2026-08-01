import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertLegacyPayloadLimits,
  legacyPayloadToCore,
  versionRowsToLegacyPayload,
  coreToLegacyPayload,
} from "../services/template-v2-mappers";
import { validateLegacyTemplatePayload } from "../services/template-v2-validation-service";
import { isDangerousUrl, assertPayloadSize } from "../services/template-v2-limits";
import { TemplateV2DomainError } from "../services/template-v2-errors";
import { parseTemplateBinding } from "@repo/template-engine";

const basePayload = {
  canvas: { width: 1000, height: 800 },
  blocks: [
    {
      id: "b1",
      type: "TEXT" as const,
      layout: {
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        rotation: 0,
        zIndex: 1,
        opacity: 1,
        visible: true,
      },
      configJson: { content: "{alumno}", fontFamily: "Inter", fontSize: 20 },
    },
  ],
  variableBindings: [] as [],
  meta: { seed: "x" },
};

describe("template-v2 mappers + security", () => {
  it("legacy → core → legacy preserva meta", () => {
    const { document } = legacyPayloadToCore(basePayload, { name: "T" });
    const { payload } = coreToLegacyPayload(document);
    assert.equal(payload.meta.seed, "x");
    assert.equal(payload.blocks[0]?.id, "b1");
  });

  it("db rows → legacy", () => {
    const legacy = versionRowsToLegacyPayload({
      canvasJson: { width: 10, height: 20 },
      metaJson: {},
      blocks: [
        {
          id: "x",
          type: "SHAPE",
          name: null,
          pageIndex: 0,
          x: 1,
          y: 2,
          width: 3,
          height: 4,
          rotation: 0,
          zIndex: 0,
          opacity: 1,
          locked: false,
          visible: true,
          configJson: { variant: "rectangle" },
        },
      ],
      bindings: [],
    });
    assert.equal(legacy.canvas.width, 10);
    assert.equal(legacy.blocks[0]?.type, "SHAPE");
  });

  it("bloquea URL peligrosa", () => {
    assert.equal(isDangerousUrl("javascript:alert(1)"), true);
    assert.throws(
      () =>
        assertLegacyPayloadLimits({
          ...basePayload,
          blocks: [
            {
              ...basePayload.blocks[0]!,
              type: "IMAGE",
              configJson: { src: "javascript:alert(1)", source: {} },
            },
          ],
        }),
      (e: unknown) => e instanceof TemplateV2DomainError && e.code === "TEMPLATE_ASSET_INVALID"
    );
  });

  it("bloquea payload excesivo", () => {
    assert.throws(
      () => assertPayloadSize(3_000_000),
      (e: unknown) => e instanceof TemplateV2DomainError && e.code === "TEMPLATE_PAYLOAD_TOO_LARGE"
    );
  });

  it("bloquea binding peligroso", () => {
    const r = parseTemplateBinding("{__proto__.x}");
    assert.equal(r.ok, false);
  });

  it("validate detecta alias deprecated", () => {
    const result = validateLegacyTemplatePayload(basePayload, { name: "V" });
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some((w) => w.code === "deprecated_alias"));
  });

  it("dimensión inválida", () => {
    assert.throws(
      () =>
        assertLegacyPayloadLimits({
          ...basePayload,
          canvas: { width: 0, height: 100 },
        }),
      (e: unknown) => e instanceof TemplateV2DomainError
    );
  });

  it("schemaVersion soportada vía bridge", () => {
    const { document } = legacyPayloadToCore(basePayload, { name: "S" });
    assert.equal(document.schemaVersion, 1);
  });
});
