import assert from "node:assert/strict";
import { test } from "node:test";
import { clampZoom, fitZoom, MAX_ZOOM, MIN_ZOOM } from "../fit-zoom";

const carnet = { canvasWidth: 1011, canvasHeight: 638 };

test("una pieza grande se achica hasta entrar", () => {
  const z = fitZoom({ ...carnet, viewportWidth: 800, viewportHeight: 600, paddingPx: 40 });
  assert.ok(z < 1);
  assert.ok(1011 * z <= 800 - 80 + 0.01, "tiene que entrar a lo ancho");
  assert.ok(638 * z <= 600 - 80 + 0.01, "y a lo alto");
});

test("manda el lado que aprieta", () => {
  // Ventana muy ancha y baja: la altura es la que limita.
  const z = fitZoom({ ...carnet, viewportWidth: 4000, viewportHeight: 400, paddingPx: 20 });
  assert.ok(Math.abs(638 * z - (400 - 40)) < 0.01);
});

test("no amplía una pieza chica: mostrarla gigante miente sobre cómo se imprime", () => {
  const z = fitZoom({ canvasWidth: 100, canvasHeight: 100, viewportWidth: 2000, viewportHeight: 2000 });
  assert.equal(z, 1);
});

test("deja aire alrededor", () => {
  const z = fitZoom({ ...carnet, viewportWidth: 1091, viewportHeight: 800, paddingPx: 40 });
  assert.ok(1011 * z <= 1011, "con 40 de aire de cada lado entra justo");
});

test("medidas imposibles no producen un zoom absurdo", () => {
  for (const caso of [
    { canvasWidth: 0, canvasHeight: 100 },
    { canvasWidth: 100, canvasHeight: 0 },
    { canvasWidth: NaN, canvasHeight: 100 },
  ]) {
    assert.equal(fitZoom({ ...caso, viewportWidth: 800, viewportHeight: 600 }), 1);
  }
});

test("una ventana más chica que el aire no rompe", () => {
  assert.equal(fitZoom({ ...carnet, viewportWidth: 50, viewportHeight: 50, paddingPx: 40 }), 1);
});

test("el resultado siempre queda dentro de los límites del control", () => {
  const z = fitZoom({ canvasWidth: 100000, canvasHeight: 100000, viewportWidth: 300, viewportHeight: 300 });
  assert.ok(z >= MIN_ZOOM);
});

test("clampZoom acota por los dos lados", () => {
  assert.equal(clampZoom(0.0001), MIN_ZOOM);
  assert.equal(clampZoom(99), MAX_ZOOM);
  assert.equal(clampZoom(0.5), 0.5);
  assert.equal(clampZoom(NaN), 1);
});
