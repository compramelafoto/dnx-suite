import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeBlockConfig } from "../render-core";

describe("guardar conserva el encuadre y las marcas del Modo Fotolibro", () => {
  it("una foto guarda su encuadre, su copia liviana, sus medidas y sus marcas", () => {
    const cfg = normalizeBlockConfig("IMAGE", {
      src: "https://r2/o.jpg",
      previewSrc: "https://r2/v.jpg",
      fit: "cover",
      srcWidth: 6000,
      srcHeight: 4000,
      crop: { zoom: 1.5, x: 0.3, y: -0.2 },
      cropAuto: true,
      fotoId: "abc",
      fotolibroAuto: true,
    });
    assert.equal(cfg.src, "https://r2/o.jpg");
    assert.equal(cfg.previewSrc, "https://r2/v.jpg");
    assert.equal(cfg.srcWidth, 6000);
    assert.equal(cfg.srcHeight, 4000);
    assert.deepEqual(cfg.crop, { zoom: 1.5, x: 0.3, y: -0.2 });
    assert.equal(cfg.cropAuto, true);
    assert.equal(cfg.fotoId, "abc");
    assert.equal(cfg.fotolibroAuto, true);
  });

  it("los títulos, bordes y fondos del fotolibro conservan su marca", () => {
    assert.equal(normalizeBlockConfig("TEXT", { content: "Ana", fotolibroAuto: true }).fotolibroAuto, true);
    assert.equal(normalizeBlockConfig("SHAPE", { fill: "#fff", fotolibroAuto: true }).fotolibroAuto, true);
    assert.equal(normalizeBlockConfig("BACKGROUND", { src: "x", fotolibroEstilo: true }).fotolibroEstilo, true);
  });

  it("un encuadre fuera de rango se acota, y lo que no corresponde no se agrega", () => {
    const cfg = normalizeBlockConfig("IMAGE", { src: "x", crop: { zoom: 9, x: 5, y: "no" }, previewSrc: "javascript:alert(1)" });
    assert.deepEqual(cfg.crop, { zoom: 4, x: 1, y: 0 });
    assert.equal("previewSrc" in cfg, false);
    assert.equal("fotolibroAuto" in normalizeBlockConfig("IMAGE", { src: "x" }), false);
  });
});
