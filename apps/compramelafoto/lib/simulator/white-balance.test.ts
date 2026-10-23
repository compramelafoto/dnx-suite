import assert from "node:assert/strict";
import { test } from "node:test";

import { computeWhiteBalanceTint } from "./camera-math";

const luminance = (t: { r: number; g: number; b: number }) => 0.2126 * t.r + 0.7152 * t.g + 0.0722 * t.b;

test("3200 K con luz de día enfría la imagen (más azul que rojo)", () => {
  const tint = computeWhiteBalanceTint(3200);
  assert.ok(tint.b > tint.r * 1.5, JSON.stringify(tint));
});

test("7500 K con luz de día calienta la imagen (más rojo que azul)", () => {
  const tint = computeWhiteBalanceTint(7500);
  assert.ok(tint.r > tint.b, JSON.stringify(tint));
});

test("6500 K (el blanco de la escena) no cambia los colores", () => {
  const tint = computeWhiteBalanceTint(6500);
  for (const v of [tint.r, tint.g, tint.b]) assert.ok(Math.abs(v - 1) < 1e-6);
});

test("cambiar el balance no cambia la exposición", () => {
  for (const k of [3200, 4200, 5600, 6500, 7500]) {
    assert.ok(Math.abs(luminance(computeWhiteBalanceTint(k)) - 1) < 1e-9, `${k} K`);
  }
});

test("a más Kelvin, la imagen se calienta de forma continua", () => {
  let prev = -Infinity;
  for (let k = 3000; k <= 8000; k += 250) {
    const tint = computeWhiteBalanceTint(k);
    const warmth = tint.r / tint.b;
    assert.ok(warmth > prev, `${k} K`);
    prev = warmth;
  }
});
