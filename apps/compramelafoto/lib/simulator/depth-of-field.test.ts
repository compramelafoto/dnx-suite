import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateBlurDiameterPx,
  calculateDepthOfFieldLimits,
  calculateHyperfocalDistance,
  calculateSceneMaxBlurPx,
  maxRenderableBlurPx,
} from "./depth-of-field";
import { dofRadiusScale, DOF_MAX_STEPS } from "./dof-shaders";

/** Retrato: 50 mm, foco a 3 m, fondo a 20 m, imagen de 1080 px de alto. */
const PORTRAIT = { focalLengthMm: 50, focusDistanceM: 3, subjectDistanceM: 20, imageHeightPx: 1080 };

const blurAt = (aperture: number, overrides: Partial<typeof PORTRAIT> = {}) =>
  calculateBlurDiameterPx({ ...PORTRAIT, ...overrides, aperture });

test("cada paso de diafragma cambia el desenfoque en √2, sin saturar", () => {
  const stops = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
  for (let i = 1; i < stops.length; i += 1) {
    const ratio = blurAt(stops[i - 1]) / blurAt(stops[i]);
    assert.ok(Math.abs(ratio - stops[i] / stops[i - 1]) < 1e-9, `f/${stops[i - 1]} → f/${stops[i]}`);
  }
  assert.ok(blurAt(1.4) > blurAt(11) * 7, "f/1.4 desenfoca ~8 veces más que f/11");
});

test("valores de referencia de una full frame (disco sobre el sensor)", () => {
  // b = f²·|d−s| / (N·d·(s−f)) = 2500·17000 / (2.8·20000·2950) ≈ 0.2573 mm
  const px = blurAt(2.8);
  assert.ok(Math.abs(px - (0.25726 / 24) * 1080) < 0.05, `f/2.8 da ${px.toFixed(2)} px`);
});

test("el punto enfocado queda nítido y delante/detrás se desenfoca", () => {
  assert.equal(blurAt(1.4, { subjectDistanceM: 3 }), 0);
  assert.ok(blurAt(2.8, { subjectDistanceM: 1.5 }) > 1);
  assert.ok(blurAt(2.8, { subjectDistanceM: 10 }) > 1);
});

test("el cielo (infinito) se desenfoca y es el máximo de lo que está detrás", () => {
  const sky = blurAt(2.8, { subjectDistanceM: Number.POSITIVE_INFINITY });
  assert.ok(Number.isFinite(sky) && sky > blurAt(2.8, { subjectDistanceM: 1000 }) - 0.01);
  assert.ok(sky > blurAt(2.8));
});

test("teleobjetivo a igual encuadre desenfoca más el fondo", () => {
  // Mismo tamaño de sujeto: 50 mm a 3 m equivale a 100 mm a 6 m.
  const tele = calculateBlurDiameterPx({ ...PORTRAIT, focalLengthMm: 100, focusDistanceM: 6, aperture: 2.8 });
  assert.ok(tele > blurAt(2.8));
});

test("límites de nitidez coherentes con la hiperfocal", () => {
  const H = calculateHyperfocalDistance({ focalLengthMm: 50, aperture: 8 });
  assert.ok(Math.abs(H - 10.467) < 0.01);
  const atH = calculateDepthOfFieldLimits({ focusDistanceM: H, focalLengthMm: 50, aperture: 8 });
  assert.equal(atH.farLimitM, Number.POSITIVE_INFINITY);
  assert.ok(Math.abs(atH.nearLimitM - H / 2) < 0.05);
});

test("el tope de render sólo actúa en casos extremos", () => {
  const cap = maxRenderableBlurPx(1080);
  assert.ok(blurAt(1.4) < cap, "un retrato a f/1.4 no toca el tope");
  const macro = calculateSceneMaxBlurPx({ focalLengthMm: 100, focusDistanceM: 0.5, aperture: 2.8, imageHeightPx: 1080 });
  assert.equal(macro, cap);
});

test("la espiral del shader alcanza el radio máximo dentro del tope de pasos", () => {
  for (const diameter of [1, 4, 12, 22, 40, maxRenderableBlurPx(2160)]) {
    const scale = dofRadiusScale(diameter);
    let radius = Math.sqrt(scale);
    let steps = 0;
    while (radius < diameter / 2 && steps < DOF_MAX_STEPS) {
      radius += scale / radius;
      steps += 1;
    }
    assert.ok(radius >= diameter / 2, `diámetro ${diameter} px en ${steps} pasos`);
  }
});
