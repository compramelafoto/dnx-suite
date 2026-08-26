import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listTemplateV2ForPicker,
  loadTemplateV2LegacyPayload,
} from "./template-v2-repository";

const VERSION = {
  id: "ver_1",
  templateId: "tpl_1",
  versionNumber: 2,
  revision: 5,
  updatedAt: new Date("2026-08-26T00:00:00Z"),
  canvasJson: { width: 1080, height: 1920, background: "#000000", dpi: 72 },
  metaJson: { product: "clickaton" },
};

const BLOCK = {
  id: "b1",
  type: "VARIABLE_TEXT",
  name: "Nombre",
  pageIndex: 0,
  x: 10,
  y: 20,
  width: 300,
  height: 80,
  rotation: 0,
  zIndex: 3,
  opacity: 1,
  locked: false,
  visible: true,
  configJson: { variableKey: "participant.fullName" },
};

const BINDING = {
  id: "bind_1",
  blockId: "b1",
  targetPath: "variableKey",
  variableKey: "participant.fullName",
  formatter: null,
  fallbackOverride: null,
};

function fakeDb(over: Record<string, unknown> = {}) {
  return {
    templateV2: {
      findUnique: async () => ({
        id: "tpl_1",
        name: "Mi placa",
        currentVersionId: "ver_1",
      }),
      findMany: async () => [
        {
          id: "tpl_1",
          name: "Mi placa",
          description: null,
          status: "DRAFT",
          currentVersionId: "ver_1",
          updatedAt: new Date("2026-08-26T00:00:00Z"),
        },
      ],
    },
    templateV2Version: {
      findFirst: async () => VERSION,
      findMany: async () => [VERSION],
    },
    templateV2Block: { findMany: async () => [BLOCK] },
    templateV2VariableBinding: { findMany: async () => [BINDING] },
    ...over,
  } as never;
}

describe("loadTemplateV2LegacyPayload", () => {
  it("arma el payload legacy con lienzo, bloques y bindings", async () => {
    const result = await loadTemplateV2LegacyPayload(fakeDb(), { templateId: "tpl_1" });
    assert.ok(result);
    assert.equal(result.templateName, "Mi placa");
    assert.equal(result.versionNumber, 2);
    assert.equal(result.revision, 5);
    assert.equal(result.product, "clickaton");
    assert.equal(result.payload.canvas.width, 1080);
    assert.equal(result.payload.blocks.length, 1);
    assert.equal(result.payload.blocks[0]!.layout.zIndex, 3);
    assert.equal(result.payload.variableBindings?.[0]!.variableKey, "participant.fullName");
  });

  it("devuelve null si la plantilla no existe", async () => {
    const result = await loadTemplateV2LegacyPayload(
      fakeDb({ templateV2: { findUnique: async () => null, findMany: async () => [] } }),
      { templateId: "tpl_x" }
    );
    assert.equal(result, null);
  });

  it("devuelve null si la plantilla no tiene versiones", async () => {
    const result = await loadTemplateV2LegacyPayload(
      fakeDb({
        templateV2Version: { findFirst: async () => null, findMany: async () => [] },
      }),
      { templateId: "tpl_1" }
    );
    assert.equal(result, null);
  });

  it("usa valores por defecto si el lienzo viene incompleto", async () => {
    const result = await loadTemplateV2LegacyPayload(
      fakeDb({
        templateV2Version: {
          findFirst: async () => ({ ...VERSION, canvasJson: null, metaJson: null }),
          findMany: async () => [],
        },
      }),
      { templateId: "tpl_1" }
    );
    assert.ok(result);
    assert.equal(result.payload.canvas.width, 1080);
    assert.equal(result.payload.canvas.height, 1920);
    assert.equal(result.product, null);
  });
});

describe("listTemplateV2ForPicker", () => {
  it("lista plantillas con medidas y producto", async () => {
    const rows = await listTemplateV2ForPicker(fakeDb());
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.name, "Mi placa");
    assert.equal(rows[0]!.product, "clickaton");
    assert.equal(rows[0]!.canvasWidth, 1080);
    assert.equal(rows[0]!.canvasHeight, 1920);
  });

  it("filtra por producto y opcionalmente incluye las sin marcar", async () => {
    assert.equal((await listTemplateV2ForPicker(fakeDb(), { product: "school" })).length, 0);
    assert.equal((await listTemplateV2ForPicker(fakeDb(), { product: "clickaton" })).length, 1);

    const unmarked = fakeDb({
      templateV2Version: {
        findFirst: async () => VERSION,
        findMany: async () => [{ ...VERSION, metaJson: {} }],
      },
    });
    assert.equal((await listTemplateV2ForPicker(unmarked, { product: "clickaton" })).length, 0);
    assert.equal(
      (
        await listTemplateV2ForPicker(unmarked, {
          product: "clickaton",
          includeUnknownProduct: true,
        })
      ).length,
      1
    );
  });
});
