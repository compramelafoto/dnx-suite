import assert from "node:assert/strict";
import { test } from "node:test";
import { computeCoverCropRect } from "@repo/template-editor-core";
import { encuadreDeCara } from "./encuadre-de-cara";

/** Dónde cae la cara dentro del recuadro, en fracciones del recuadro visible. */
function caraEnElRecuadro(
  bbox: { left: number; top: number; width: number; height: number },
  aspectoFoto: number,
  aspectoRecuadro: number,
) {
  const crop = encuadreDeCara({ bbox, aspectoFoto, aspectoRecuadro });
  const W = 1000 * aspectoFoto;
  const H = 1000;
  const r = computeCoverCropRect({ srcWidth: W, srcHeight: H, slotWidth: aspectoRecuadro * 100, slotHeight: 100, crop });
  return {
    crop,
    cx: (bbox.left * W + (bbox.width * W) / 2 - r.left) / r.width,
    cy: (bbox.top * H + (bbox.height * H) / 2 - r.top) / r.height,
    alto: (bbox.height * H) / r.height,
  };
}

test("una cara centrada en un plano medio queda centrada a lo ancho y arriba del medio", () => {
  const r = caraEnElRecuadro({ left: 0.38, top: 0.18, width: 0.24, height: 0.24 }, 0.75, 0.75);
  assert.ok(Math.abs(r.cx - 0.5) < 0.02, `cx ${r.cx}`);
  assert.ok(Math.abs(r.cy - 0.42) < 0.03, `cy ${r.cy}`);
  assert.ok(Math.abs(r.alto - 0.4) < 0.03, `alto ${r.alto}`);
});

test("una cara corrida a la izquierda se trae al centro", () => {
  const r = caraEnElRecuadro({ left: 0.1, top: 0.2, width: 0.2, height: 0.2 }, 1.5, 0.75);
  assert.ok(r.crop.x < 0);
  assert.ok(Math.abs(r.cx - 0.5) < 0.05, `cx ${r.cx}`);
});

test("el zoom queda entre 1 y 4 aunque la cara sea enorme o diminuta", () => {
  assert.equal(encuadreDeCara({ bbox: { left: 0, top: 0, width: 1, height: 1 }, aspectoFoto: 0.75, aspectoRecuadro: 0.75 }).zoom, 1);
  assert.equal(encuadreDeCara({ bbox: { left: 0.5, top: 0.5, width: 0.01, height: 0.01 }, aspectoFoto: 0.75, aspectoRecuadro: 0.75 }).zoom, 4);
});

test("sin detección de caras, el encuadre fijo de plano medio sube y acerca", () => {
  const c = encuadreDeCara({ aspectoFoto: 0.75, aspectoRecuadro: 0.75 });
  assert.ok(c.zoom > 1);
  assert.ok(c.y < 0);
  assert.equal(c.x, 0);
});

test("los valores quedan dentro de los rangos del encuadre", () => {
  const c = encuadreDeCara({ bbox: { left: 0.9, top: 0.9, width: 0.1, height: 0.1 }, aspectoFoto: 1.5, aspectoRecuadro: 0.75 });
  assert.ok(c.x >= -1 && c.x <= 1 && c.y >= -1 && c.y <= 1);
});
