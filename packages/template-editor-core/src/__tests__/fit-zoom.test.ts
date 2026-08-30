import assert from "node:assert/strict";
import { test } from "node:test";
import { fitZoom, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from "../fit-zoom";

test("una hoja más alta que ancha se ajusta por el alto, no por el ancho", () => {
  // El caso que hacía scrollear: carnet vertical de 638×1016 en un área apaisada.
  const z = fitZoom(900, 600, 638, 1016);
  assert.equal(z, 600 / 1016);
  assert.ok(638 * z! <= 900, "tiene que entrar también a lo ancho");
});

test("una hoja más ancha que alta se ajusta por el ancho", () => {
  const z = fitZoom(400, 900, 1000, 500);
  assert.equal(z, 400 / 1000);
  assert.ok(500 * z! <= 900);
});

test("la hoja entra completa en los dos ejes", () => {
  const casos: Array<[number, number, number, number]> = [
    [1200, 800, 638, 1016],
    [500, 500, 2000, 100],
    [300, 900, 100, 100],
    [1024, 768, 1024, 768],
  ];
  for (const [w, h, cw, ch] of casos) {
    const z = fitZoom(w, h, cw, ch)!;
    assert.ok(cw * z <= w + 0.001, `ancho: ${cw}x${ch} en ${w}x${h}`);
    assert.ok(ch * z <= h + 0.001, `alto: ${cw}x${ch} en ${w}x${h}`);
  }
});

test("no pasa de los límites de zoom", () => {
  assert.equal(fitZoom(10000, 10000, 10, 10), MAX_CANVAS_ZOOM);
  assert.equal(fitZoom(10, 10, 10000, 10000), MIN_CANVAS_ZOOM);
});

test("sin medidas todavía no hay respuesta", () => {
  assert.equal(fitZoom(0, 600, 638, 1016), null);
  assert.equal(fitZoom(900, 0, 638, 1016), null);
  assert.equal(fitZoom(900, 600, 0, 1016), null);
  assert.equal(fitZoom(900, 600, 638, 0), null);
  assert.equal(fitZoom(Number.NaN, 600, 638, 1016), null);
});
