import assert from "node:assert/strict";
import { test } from "node:test";

import { focalLengthToFov } from "./camera-math";
import {
  canvasSensorHeightMm,
  frameNdcToCanvasNdc,
  getViewfinderCropRect,
} from "./viewfinder-frame";

const SIZES: [number, number][] = [
  [1600, 900],
  [1000, 1000],
  [700, 1200],
  [655, 534],
];

test("la foto sale siempre en 3:2, sea cual sea la ventana", () => {
  for (const [w, h] of SIZES) {
    const crop = getViewfinderCropRect(w, h);
    assert.ok(Math.abs(crop.width / crop.height - 1.5) < 0.01, `${w}×${h}`);
    assert.ok(Math.abs(crop.x + crop.width / 2 - w / 2) <= 1, "centrado horizontal");
    assert.ok(Math.abs(crop.y + crop.height / 2 - h / 2) <= 1, "centrado vertical (eje óptico)");
  }
});

test("el recuadro ve el ángulo de un full frame: 50 mm = 39,6° horizontal", () => {
  for (const [w, h] of SIZES) {
    const crop = getViewfinderCropRect(w, h);
    const vFovRad = (focalLengthToFov(50, canvasSensorHeightMm(w, h)) * Math.PI) / 180;
    // Ángulo horizontal que cubre el recuadro dentro de la proyección del canvas.
    const tanHalfH = Math.tan(vFovRad / 2) * (w / h) * (crop.width / w);
    const hFovDeg = (2 * Math.atan(tanHalfH) * 180) / Math.PI;
    const expected = (2 * Math.atan(18 / 50) * 180) / Math.PI;
    assert.ok(Math.abs(hFovDeg - expected) < 0.2, `${w}×${h}: ${hFovDeg.toFixed(2)}°`);
  }
});

test("los puntos AF del borde del recuadro caen en el borde del recuadro en el canvas", () => {
  const [w, h] = [1600, 900];
  const crop = getViewfinderCropRect(w, h);
  const [nx, ny] = frameNdcToCanvasNdc(1, 1, w, h);
  assert.ok(Math.abs(((nx + 1) / 2) * w - (crop.x + crop.width)) <= 1);
  assert.ok(Math.abs(((1 - ny) / 2) * h - crop.y) <= 1);
});
