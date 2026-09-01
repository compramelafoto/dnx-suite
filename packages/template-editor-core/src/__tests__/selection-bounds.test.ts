import assert from "node:assert/strict";
import { test } from "node:test";
import { offsetsWithinSelection, selectionBounds } from "../selection-bounds";
import type { TemplateV2Block } from "../render-core";

const b = (id: string, x: number, y: number, width: number, height: number): TemplateV2Block => ({
  id, type: "SHAPE", pageIndex: 0,
  layout: { x, y, width, height, rotation: 0, zIndex: 0, opacity: 1, visible: true, locked: false },
  configJson: {},
});

const A = b("a", 10, 20, 100, 50);   // 10..110 × 20..70
const B = b("b", 200, 10, 60, 200);  // 200..260 × 10..210

test("envuelve a los dos bloques", () => {
  const r = selectionBounds([A, B], ["a", "b"]);
  assert.deepEqual(r, { x: 10, y: 10, width: 250, height: 200 });
});

test("con un solo bloque, la caja es ese bloque", () => {
  assert.deepEqual(selectionBounds([A, B], ["a"]), { x: 10, y: 20, width: 100, height: 50 });
});

test("sin selección no devuelve una caja vacía, devuelve nada", () => {
  // Un rectángulo de cero por cero mentiría: hay que poder distinguir los dos casos.
  assert.equal(selectionBounds([A, B], []), null);
  assert.equal(selectionBounds([], ["a"]), null);
});

test("ignora ids que no existen", () => {
  assert.deepEqual(selectionBounds([A, B], ["a", "fantasma"]), {
    x: 10, y: 20, width: 100, height: 50,
  });
});

test("las posiciones relativas se calculan contra la caja", () => {
  const caja = selectionBounds([A, B], ["a", "b"])!;
  const offs = offsetsWithinSelection([A, B], ["a", "b"], caja);
  assert.deepEqual(offs, [
    { id: "a", dx: 0, dy: 10 },
    { id: "b", dx: 190, dy: 0 },
  ]);
});

test("mover la caja y reponer las posiciones conserva la distancia entre bloques", () => {
  /*
   * Es la garantía que importa al arrastrar en conjunto: dos elementos tienen que llegar al
   * destino con la misma separación con la que salieron.
   */
  const caja = selectionBounds([A, B], ["a", "b"])!;
  const offs = offsetsWithinSelection([A, B], ["a", "b"], caja);
  const destino = { x: 500, y: 300 };
  const finales = offs.map((o) => ({ id: o.id, x: destino.x + o.dx, y: destino.y + o.dy }));

  const separacionAntes = B.layout.x - A.layout.x;
  const separacionDespues = finales[1]!.x - finales[0]!.x;
  assert.equal(separacionDespues, separacionAntes);
  assert.deepEqual(finales[0], { id: "a", x: 500, y: 310 });
});

test("centrar el conjunto centra la caja, no cada bloque", () => {
  const caja = selectionBounds([A, B], ["a", "b"])!;
  const lienzo = 1000;
  const xCentrada = (lienzo - caja.width) / 2;
  assert.equal(xCentrada, 375);
  // Si se centrara cada bloque por separado, los dos irían al mismo lugar y se encimarían.
  assert.notEqual((lienzo - A.layout.width) / 2, (lienzo - B.layout.width) / 2);
});
