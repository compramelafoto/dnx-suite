import assert from "node:assert/strict";
import { test } from "node:test";
import { histogramFromLuminance, histogramFromPixels } from "./histogram";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

test("histograma: suma 1 y una escena gris queda en el medio", () => {
  const h = histogramFromLuminance(new Float32Array(100).fill(0.18), 1);
  assert.ok(Math.abs(sum(h.bins) - 1) < 1e-9);
  const peak = h.bins.indexOf(Math.max(...h.bins));
  assert.ok(peak > 20 && peak < 45, `pico en ${peak}`);
});

test("histograma: subir la exposición corre todo a la derecha hasta quemar", () => {
  const lum = new Float32Array(100).fill(0.18);
  const peakAt = (e: number) => {
    const h = histogramFromLuminance(lum, e);
    return h.bins.indexOf(Math.max(...h.bins));
  };
  assert.ok(peakAt(4) > peakAt(1));
  assert.ok(histogramFromLuminance(lum, 200).clippedHighlights > 0.9);
  assert.ok(histogramFromLuminance(lum, 0.001).clippedShadows > 0.9);
});

test("histograma de la foto: negro, gris y blanco en su lugar", () => {
  const px = [0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255];
  const h = histogramFromPixels(px, 4);
  assert.deepEqual(h.bins.map((b) => Math.round(b * 3)), [1, 0, 1, 1]);
  assert.ok(Math.abs(h.clippedShadows - 1 / 3) < 1e-9);
  assert.ok(Math.abs(h.clippedHighlights - 1 / 3) < 1e-9);
});
