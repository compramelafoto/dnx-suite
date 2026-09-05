import assert from "node:assert/strict";
import { test } from "node:test";

import { pickSelectionPhotosForDesign } from "./ensure-school-design-for-preventa-order-item";

/**
 * Regresión: cuando el pack mezcla beneficios digitales e impresos, el diseño de la carpeta
 * se armaba con las fotos que la familia había elegido para descargar, porque los huecos de la
 * plantilla se llenan por orden de posición y el beneficio digital va primero.
 */

const DIGITAL = "pack:benefit:digital";
const IMPRESO = "pack:benefit:impreso";

/** Lo que la familia eligió, en el orden en que se guarda (digitales primero). */
const fotosElegidas = [
  { id: 1, photoId: 900, role: null, position: 0 },
  { id: 2, photoId: 901, role: null, position: 1 },
  { id: 3, photoId: 910, role: null, position: 2 },
  { id: 4, photoId: 911, role: null, position: 3 },
];

const porBeneficio = new Map<string, number[]>([
  [DIGITAL, [900, 901]],
  [IMPRESO, [910, 911]],
]);

test("la plantilla del pack solo recibe las fotos de su beneficio", () => {
  const elegidas = pickSelectionPhotosForDesign(
    fotosElegidas,
    { source: "PACK_REQUIRED", benefitStableKeys: [IMPRESO] },
    porBeneficio
  );

  assert.deepEqual(
    elegidas.map((p) => p.photoId),
    [910, 911],
    "el diseño impreso tiene que usar las fotos elegidas para imprimir, no las digitales"
  );
});

test("suma las fotos cuando varios beneficios comparten la misma plantilla", () => {
  const elegidas = pickSelectionPhotosForDesign(
    fotosElegidas,
    { source: "PACK_REQUIRED", benefitStableKeys: [DIGITAL, IMPRESO] },
    porBeneficio
  );

  assert.deepEqual(elegidas.map((p) => p.photoId), [900, 901, 910, 911]);
});

test("sin fotos del beneficio devuelve vacío: preferible no diseñar a diseñar mal", () => {
  const elegidas = pickSelectionPhotosForDesign(
    fotosElegidas,
    { source: "PACK_REQUIRED", benefitStableKeys: [IMPRESO] },
    new Map([[IMPRESO, [777]]])
  );

  assert.deepEqual(elegidas, []);
});

test("si la plantilla no viene del pack, no filtra nada", () => {
  const elegidas = pickSelectionPhotosForDesign(
    fotosElegidas,
    { source: "ALBUM_PRODUCT_DEFAULT", benefitStableKeys: [] },
    porBeneficio
  );

  assert.equal(elegidas.length, 4);
});

test("sin el mapa por beneficio mantiene el comportamiento anterior", () => {
  const elegidas = pickSelectionPhotosForDesign(
    fotosElegidas,
    { source: "PACK_REQUIRED", benefitStableKeys: [IMPRESO] },
    null
  );

  assert.equal(elegidas.length, 4);
});

test("un beneficio sin fotos asignadas no restringe la plantilla", () => {
  const elegidas = pickSelectionPhotosForDesign(
    fotosElegidas,
    { source: "PACK_REQUIRED", benefitStableKeys: ["pack:benefit:inexistente"] },
    porBeneficio
  );

  assert.equal(elegidas.length, 4);
});
