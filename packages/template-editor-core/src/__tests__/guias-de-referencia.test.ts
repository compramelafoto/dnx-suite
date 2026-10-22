import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildReferenceGuideLines,
  defaultReferenceGuides,
  isFoldedSpread,
  parseStoredReferenceGuides,
  referenceGuideSnapLines,
  REFERENCE_GUIDES_ALL_OFF,
  REFERENCE_GUIDES_STORAGE_KEY,
  resolveReferenceGuides,
  toggleAllReferenceGuides,
  withReferenceGuides,
} from "../editor-reference-guides";
import { snapDragPosition } from "../snap-drag-to-canvas";

// El librito abierto de 300 × 200 mm a 300 dpi, con el pliegue como guía de diseño.
const W = 3543;
const H = 2362;
const metaLibrito = { templatePageCount: 2, guides: { h: [], v: [1771.5] }, foldGuideMmFromLeft: 150 };

test("reconoce un librito abierto por la medida del pliegue o por una guía en la mitad", () => {
  assert.equal(isFoldedSpread(metaLibrito, { width: W, height: H }), true);
  assert.equal(isFoldedSpread({ guides: { v: [1771.5], h: [] } }, { width: W, height: H }), true);
  assert.equal(isFoldedSpread({ guides: { v: [900], h: [] } }, { width: W, height: H }), false);
  assert.equal(isFoldedSpread({ templatePageCount: 2 }, { width: 1200, height: 1800 }), false);
  assert.equal(isFoldedSpread(null, { width: W, height: H }), false);
});

test("de fábrica: el librito viene con el pliegue; una hoja común con los dos ejes", () => {
  assert.deepEqual(defaultReferenceGuides(true), { ...REFERENCE_GUIDES_ALL_OFF, fold: true });
  assert.deepEqual(defaultReferenceGuides(false), { ...REFERENCE_GUIDES_ALL_OFF, fold: true, halfH: true });
});

test("posiciones: mitades, cuartos y el centro de cada cara", () => {
  const todas = toggleAllReferenceGuides(REFERENCE_GUIDES_ALL_OFF);
  const { lines, crosses } = buildReferenceGuideLines(todas, 4000, 2000);
  const v = lines.filter((l) => l.axis === "v").map((l) => l.pos);
  const h = lines.filter((l) => l.axis === "h").map((l) => l.pos);
  assert.deepEqual(v, [2000, 1000, 3000]);
  assert.deepEqual(h, [1000, 500, 1500]);
  assert.deepEqual(crosses, [
    { x: 1000, y: 1000 },
    { x: 3000, y: 1000 },
  ]);
  assert.equal(lines.find((l) => l.pos === 2000)?.kind, "fold");
});

test("no dibuja encima de una guía de diseño que ya está en el mismo lugar", () => {
  const { lines } = buildReferenceGuideLines({ ...REFERENCE_GUIDES_ALL_OFF, fold: true, quartersV: true }, W, H, {
    v: [1771.5],
    h: [],
  });
  assert.deepEqual(
    lines.map((l) => l.pos),
    [W / 4, (3 * W) / 4]
  );
});

test("todo apagado: ni líneas ni imán extra", () => {
  assert.deepEqual(buildReferenceGuideLines(REFERENCE_GUIDES_ALL_OFF, W, H), { lines: [], crosses: [] });
  assert.deepEqual(referenceGuideSnapLines(REFERENCE_GUIDES_ALL_OFF, W, H), { xs: [], ys: [] });
});

test("mostrar / ocultar todas", () => {
  const todas = toggleAllReferenceGuides({ ...REFERENCE_GUIDES_ALL_OFF, fold: true });
  assert.deepEqual(todas, REFERENCE_GUIDES_ALL_OFF);
  assert.equal(Object.values(toggleAllReferenceGuides(todas)).every(Boolean), true);
});

test("el imán pega el centro de un bloque al centro de la cara derecha", () => {
  const s = { ...REFERENCE_GUIDES_ALL_OFF, quartersV: true };
  const extra = referenceGuideSnapLines(s, 4000, 2000);
  assert.deepEqual(extra, { xs: [1000, 3000], ys: [] });
  // Bloque de 400 de ancho con el centro en 3005: queda en 3000.
  const r = snapDragPosition(4000, 2000, 400, 300, 2805, 100, "yo", [], 8, {
    guidesX: extra.xs,
    guidesY: extra.ys,
  });
  assert.equal(r.x, 2800);
  assert.equal(r.guideVerticalX, 3000);
});

test("con la guía apagada el imán no se pega al cuarto", () => {
  const extra = referenceGuideSnapLines(REFERENCE_GUIDES_ALL_OFF, 4000, 2000);
  const r = snapDragPosition(4000, 2000, 400, 300, 2805, 100, "yo", [], 8, { guidesX: extra.xs, guidesY: extra.ys });
  assert.equal(r.x, 2805);
  assert.equal(r.guideVerticalX, null);
});

test("el borde de un bloque se pega al cuarto horizontal y la crucecita imanta el centro de la cara", () => {
  const extra = referenceGuideSnapLines({ ...REFERENCE_GUIDES_ALL_OFF, quartersH: true, faceCenters: true }, 4000, 2000);
  assert.deepEqual(extra, { xs: [1000, 3000], ys: [1000, 500, 1500] });
  const r = snapDragPosition(4000, 2000, 200, 200, 895, 1504, "yo", [], 8, { guidesX: extra.xs, guidesY: extra.ys });
  assert.equal(r.x, 900); // centro del bloque (1000) sobre el centro de la cara izquierda
  assert.equal(r.y, 1500); // borde superior sobre el cuarto de abajo
});

test("la elección se recuerda por separado para libritos y hojas, y lo roto se ignora", () => {
  assert.equal(REFERENCE_GUIDES_STORAGE_KEY.length > 0, true);
  assert.deepEqual(parseStoredReferenceGuides(null), {});
  assert.deepEqual(parseStoredReferenceGuides("{no es json"), {});
  assert.deepEqual(parseStoredReferenceGuides(JSON.stringify({ spread: { fold: "sí" } })), {});

  const apagado = { ...REFERENCE_GUIDES_ALL_OFF, quartersV: true };
  const guardado = withReferenceGuides({}, true, apagado);
  const leido = parseStoredReferenceGuides(JSON.stringify(guardado));
  assert.deepEqual(resolveReferenceGuides(leido, true), apagado);
  // La hoja común sigue con lo de fábrica.
  assert.deepEqual(resolveReferenceGuides(leido, false), defaultReferenceGuides(false));
});
