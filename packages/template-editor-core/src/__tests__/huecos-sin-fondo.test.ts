import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { huecosSinFondo, quitaElFondo } from "../huecos-sin-fondo";

describe("huecos que quitan el fondo", () => {
  it("sólo cuentan las imágenes marcadas", () => {
    const blocks = [
      { id: "a", type: "IMAGE", configJson: { removeBackground: true, source: { variableKey: "photo_individual" } } },
      { id: "b", type: "IMAGE", configJson: { source: { variableKey: "photo_group" } } },
      { id: "c", type: "TEXT", configJson: { removeBackground: true } },
      { id: "d", type: "PHOTO", configJson: { removeBackground: "sí" } },
    ];
    assert.deepEqual([...huecosSinFondo(blocks)], ["a"]);
  });

  it("lee la marca del bloque", () => {
    assert.equal(quitaElFondo({ removeBackground: true }), true);
    assert.equal(quitaElFondo({}), false);
    assert.equal(quitaElFondo(null), false);
  });
});

import { normalizeBlockConfig } from "../render-core";

describe("normalizeBlockConfig — quitar el fondo", () => {
  it("conserva la marca del hueco al normalizar la imagen", () => {
    assert.equal((normalizeBlockConfig("IMAGE", { removeBackground: true }) as Record<string, unknown>).removeBackground, true);
    assert.equal("removeBackground" in normalizeBlockConfig("IMAGE", {}), false);
  });
});
