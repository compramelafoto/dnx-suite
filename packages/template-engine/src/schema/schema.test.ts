import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEMPLATE_SCHEMA_VERSION } from "../core/constants";
import {
  createEmptyTemplateDocument,
  parseTemplateDocument,
} from "./parse";

describe("template document schema", () => {
  it("acepta plantilla válida mínima", () => {
    const doc = createEmptyTemplateDocument({ name: "Demo", width: 800, height: 600 });
    const result = parseTemplateDocument(doc);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.schemaVersion, TEMPLATE_SCHEMA_VERSION);
      assert.equal(result.data.unit, "px");
      assert.equal(result.data.name, "Demo");
    }
  });

  it("rechaza plantilla inválida (width <= 0)", () => {
    const result = parseTemplateDocument({
      schemaVersion: 1,
      name: "Bad",
      width: 0,
      height: 100,
      unit: "px",
      blocks: [],
      bindings: [],
    });
    assert.equal(result.ok, false);
  });

  it("rechaza schemaVersion no soportada", () => {
    const result = parseTemplateDocument({
      schemaVersion: 99,
      name: "Future",
      width: 100,
      height: 100,
      unit: "px",
      blocks: [],
      bindings: [],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /no soportada/);
    }
  });

  it("rechaza tipo de bloque desconocido", () => {
    const result = parseTemplateDocument({
      schemaVersion: 1,
      name: "X",
      width: 100,
      height: 100,
      unit: "px",
      blocks: [
        {
          id: "b1",
          type: "CONTAINER",
          layout: {
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            rotation: 0,
            zIndex: 0,
            opacity: 1,
            visible: true,
          },
          config: {},
        },
      ],
      bindings: [],
    });
    assert.equal(result.ok, false);
  });

  it("permite campos opcionales (print, background, metadata)", () => {
    const result = parseTemplateDocument({
      schemaVersion: 1,
      name: "Print",
      width: 3000,
      height: 2000,
      unit: "px",
      background: { color: "#fff" },
      print: { dpi: 254, bleedMm: 0, safeAreaMm: 5 },
      blocks: [],
      bindings: [],
      metadata: { seedId: "x" },
    });
    assert.equal(result.ok, true);
  });
});
