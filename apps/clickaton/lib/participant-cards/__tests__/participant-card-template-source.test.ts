import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TemplateV2LoadResult } from "@repo/db/template-v2-repository";
import {
  resolveParticipantCardTemplate,
  templateV2ToCardPreset,
  validateClickatonCardTemplate,
} from "../participant-card-template-source";

function block(over: Record<string, unknown> = {}) {
  return {
    id: "b1",
    type: "VARIABLE_TEXT",
    name: "Nombre",
    pageIndex: 0,
    layout: { x: 0, y: 0, width: 100, height: 50 },
    configJson: { variableKey: "participant.fullName" },
    ...over,
  };
}

function loadResult(over: Partial<TemplateV2LoadResult> = {}): TemplateV2LoadResult {
  return {
    templateId: "tpl_1",
    templateName: "Mi placa",
    versionId: "ver_1",
    versionNumber: 3,
    revision: 7,
    updatedAt: new Date("2026-08-26T00:00:00Z"),
    product: "clickaton",
    payload: {
      canvas: { width: 1080, height: 1920 },
      blocks: [block()],
      variableBindings: [],
      meta: {},
    },
    ...over,
  };
}

describe("validateClickatonCardTemplate", () => {
  it("acepta una plantilla con variables de Clickatón", () => {
    assert.deepEqual(validateClickatonCardTemplate(loadResult().payload), []);
  });

  it("rechaza variables que Clickatón no conoce", () => {
    const issues = validateClickatonCardTemplate({
      canvas: { width: 1080, height: 1920 },
      blocks: [block({ configJson: { variableKey: "student.fullName" } })],
    });
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.code, "UNKNOWN_VARIABLE");
    assert.match(issues[0]!.message, /student\.fullName/);
  });

  it("rechaza tipos de bloque que el motor no dibuja", () => {
    const issues = validateClickatonCardTemplate({
      canvas: { width: 1080, height: 1920 },
      blocks: [block({ type: "QR_CODE", configJson: {} })],
    });
    assert.equal(issues[0]!.code, "UNSUPPORTED_BLOCK");
  });

  it("rechaza plantillas vacías o con lienzo inválido", () => {
    assert.equal(
      validateClickatonCardTemplate({ canvas: { width: 1080, height: 1920 }, blocks: [] })[0]!.code,
      "NO_BLOCKS"
    );
    const issues = validateClickatonCardTemplate({
      canvas: { width: 0, height: 0 },
      blocks: [block()],
    });
    assert.ok(issues.some((i) => i.code === "CANVAS_INVALID"));
  });

  it("mira también las variables de imagen y los bindings", () => {
    const issues = validateClickatonCardTemplate({
      canvas: { width: 1080, height: 1920 },
      blocks: [
        block({
          type: "PHOTO",
          configJson: { source: { variableKey: "participant.photoUrl" } },
        }),
      ],
      variableBindings: [
        { blockId: "b1", targetPath: "variableKey", variableKey: "inventada.x" },
      ],
    });
    assert.equal(issues.length, 1);
    assert.match(issues[0]!.message, /inventada\.x/);
  });
});

describe("templateV2ToCardPreset", () => {
  it("conserva el lienzo y los bloques, y deja rastro de la versión", () => {
    const preset = templateV2ToCardPreset(loadResult(), "welcome");
    assert.equal(preset.payload.canvas.width, 1080);
    assert.equal(preset.payload.blocks.length, 1);
    assert.equal(preset.meta.templateVersion, 3);
    assert.match(preset.presetId, /^template-v2:tpl_1:ver_1$/);
  });

  it("completa los valores de layout que la base deja opcionales", () => {
    const preset = templateV2ToCardPreset(loadResult(), "welcome");
    const layout = preset.payload.blocks[0]!.layout;
    assert.equal(layout.rotation, 0);
    assert.equal(layout.opacity, 1);
    assert.equal(layout.visible, true);
  });
});

describe("resolveParticipantCardTemplate", () => {
  const preset = { loadAssignment: async () => null, loadTemplate: async () => null };

  it("sin edición usa el preset oficial", async () => {
    const result = await resolveParticipantCardTemplate({ cardType: "welcome" }, preset);
    assert.equal(result.origin, "preset");
    assert.deepEqual(result.warnings, []);
  });

  it("sin asignación usa el preset oficial", async () => {
    const result = await resolveParticipantCardTemplate(
      { cardType: "welcome", editionId: "ed_1" },
      preset
    );
    assert.equal(result.origin, "preset");
  });

  it("usa la plantilla asignada cuando es válida", async () => {
    const result = await resolveParticipantCardTemplate(
      { cardType: "welcome", editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "tpl_1", versionId: null, enabled: true }),
        loadTemplate: async () => loadResult(),
      }
    );
    assert.equal(result.origin, "template_v2");
    assert.equal(result.source?.templateName, "Mi placa");
    assert.deepEqual(result.warnings, []);
  });

  it("una plantilla pausada no se usa", async () => {
    const result = await resolveParticipantCardTemplate(
      { cardType: "welcome", editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "tpl_1", versionId: null, enabled: false }),
        loadTemplate: async () => loadResult(),
      }
    );
    assert.equal(result.origin, "preset");
  });

  it("una plantilla borrada no deja sin placa: vuelve al preset y avisa", async () => {
    const result = await resolveParticipantCardTemplate(
      { cardType: "welcome", editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "tpl_x", versionId: null, enabled: true }),
        loadTemplate: async () => null,
      }
    );
    assert.equal(result.origin, "preset");
    assert.match(result.warnings[0]!, /ya no existe/);
  });

  it("una plantilla inválida vuelve al preset explicando el motivo", async () => {
    const result = await resolveParticipantCardTemplate(
      { cardType: "welcome", editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "tpl_1", versionId: null, enabled: true }),
        loadTemplate: async () =>
          loadResult({
            payload: {
              canvas: { width: 1080, height: 1920 },
              blocks: [block({ configJson: { variableKey: "student.fullName" } })],
            },
          }),
      }
    );
    assert.equal(result.origin, "preset");
    assert.match(result.warnings[0]!, /student\.fullName/);
  });

  it("un error de base no rompe la generación", async () => {
    const result = await resolveParticipantCardTemplate(
      { cardType: "welcome", editionId: "ed_1" },
      {
        loadAssignment: async () => {
          throw new Error("conexión caída");
        },
      }
    );
    assert.equal(result.origin, "preset");
    assert.match(result.warnings[0]!, /conexión caída/);
  });
});
