import { test } from "node:test";
import assert from "node:assert/strict";
import { mmToPt, ptToMm, mmToPx, pxToPt } from "./units";

test("una pulgada son 25,4 mm y 72 puntos", () => {
  assert.equal(Math.round(mmToPt(25.4) * 1000) / 1000, 72);
});

test("mmToPt y ptToMm son inversas", () => {
  const original = 85.6;
  assert.ok(Math.abs(ptToMm(mmToPt(original)) - original) < 1e-9);
});

test("mmToPx respeta los puntos por pulgada", () => {
  assert.equal(Math.round(mmToPx(25.4, 300)), 300);
  assert.equal(Math.round(mmToPx(25.4, 96)), 96);
});

test("un pixel de pantalla vale 0,75 puntos", () => {
  assert.equal(pxToPt(96), 72);
});
