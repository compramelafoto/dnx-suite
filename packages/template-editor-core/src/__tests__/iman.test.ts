import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSnapGuideLines, snapDragPosition, snapResizeRect } from "../snap-drag-to-canvas";
import type { TemplateV2Block } from "../render-core";

const bloque = (id: string, x: number, y: number, width: number, height: number, type = "IMAGE"): TemplateV2Block =>
  ({ id, type, pageIndex: 0, name: id, layout: { x, y, width, height, rotation: 0, zIndex: 1, opacity: 1, locked: false, visible: true }, configJson: {} }) as TemplateV2Block;

const otro = bloque("otro", 1000, 500, 400, 300);
const zona = { x: 60, y: 60, width: 3482, height: 2301 };

test("al mover, se pega al costado de otro bloque (mi izquierda con su derecha)", () => {
  const r = snapDragPosition(3602, 2421, 200, 200, 1405, 900, "yo", [otro], 8);
  assert.equal(r.x, 1400);
  assert.equal(r.guideVerticalX, 1400);
});

test("al mover, se pega al borde de la zona segura", () => {
  const r = snapDragPosition(3602, 2421, 200, 200, 66, 1200, "yo", [], 8, { safeArea: zona });
  assert.equal(r.x, 60);
});

test("fuera de la tolerancia no se mueve", () => {
  const r = snapDragPosition(3602, 2421, 200, 200, 1430, 900, "yo", [otro], 8);
  assert.equal(r.x, 1430);
  assert.equal(r.guideVerticalX, null);
});

test("el fondo no aporta guías propias", () => {
  const g = buildSnapGuideLines(3602, 2421, [bloque("f", 0, 0, 3602, 2421, "BACKGROUND")], new Set());
  assert.deepEqual(g.xs, [0, 1801, 3602]);
});

test("al estirar desde la esquina inferior derecha, el borde se pega a la guía y el opuesto queda quieto", () => {
  const g = buildSnapGuideLines(3602, 2421, [otro], new Set(["yo"]));
  const r = snapResizeRect("se", { x: 100, y: 100, width: 896, height: 396 }, g, 8, false);
  assert.deepEqual(r.rect, { x: 100, y: 100, width: 900, height: 400 });
  assert.equal(r.guideVerticalX, 1000);
  assert.equal(r.guideHorizontalY, 500);
});

test("al estirar desde arriba a la izquierda, se mueve el origen", () => {
  const g = { xs: [50], ys: [40] };
  const r = snapResizeRect("nw", { x: 55, y: 45, width: 500, height: 300 }, g, 8, false);
  assert.deepEqual(r.rect, { x: 50, y: 40, width: 505, height: 305 });
});

test("con proporción fija se imanta un solo eje y no se deforma", () => {
  const g = { xs: [1000], ys: [503] };
  const r = snapResizeRect("se", { x: 0, y: 0, width: 996, height: 498 }, g, 8, true);
  assert.equal(r.rect.width / r.rect.height, 2);
  assert.equal(r.guideVerticalX, 1000);
  assert.equal(r.guideHorizontalY, null);
});
