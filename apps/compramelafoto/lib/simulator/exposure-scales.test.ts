import assert from "node:assert/strict";
import { test } from "node:test";

import { shutterSpeedToSeconds } from "./camera-math";
import { computeRelativeExposureMultiplier, resolveEffectiveSettings } from "./camera-exposure";
import { APERTURE_PRESETS, ISO_PRESETS, REFERENCE_CAMERA, SHUTTER_PRESETS } from "./camera-types";
import {
  aperturesForLens,
  apertureStops,
  clampApertureToLens,
  exactAperture,
  isFullStopAperture,
  isFullStopShutterSeconds,
} from "./exposure-scales";
import { getLensById, getMaxApertureAtFocal } from "./lenses";

const lens = (id: string) => {
  const def = getLensById(id);
  assert.ok(def, id);
  return def;
};

test("cada tercio de las tres escalas vale exactamente 1/3 de paso", () => {
  const steps = (values: number[]) => values.slice(1).map((v, i) => Math.log2(v / values[i]));
  for (const s of steps(ISO_PRESETS.map((iso) => iso))) assert.ok(Math.abs(s - 1 / 3) < 0.04);
  for (const s of steps(SHUTTER_PRESETS.map((t) => shutterSpeedToSeconds(t)))) {
    assert.ok(Math.abs(s - 1 / 3) < 1e-9, `paso ${s}`);
  }
  for (const s of steps(APERTURE_PRESETS.map((f) => exactAperture(f) ** 2))) {
    assert.ok(Math.abs(s - 1 / 3) < 1e-9);
  }
});

test("los números nominales caen en su tercio exacto", () => {
  assert.ok(Math.abs(exactAperture(5.6) - 5.657) < 0.001);
  assert.ok(Math.abs(exactAperture(1.8) - 1.782) < 0.001);
  assert.ok(Math.abs(shutterSpeedToSeconds("1/125") - 1 / 128) < 1e-12);
  assert.ok(Math.abs(shutterSpeedToSeconds('0.3"') - 2 ** (-5 / 3)) < 1e-12);
});

test("un paso entero de diafragma, tiempo o ISO cambia la luz exactamente ×2", () => {
  const base = { ...REFERENCE_CAMERA, iso: 400, shutterSpeed: "1/250", aperture: 5.6 };
  const ref = computeRelativeExposureMultiplier(base);
  assert.ok(Math.abs(computeRelativeExposureMultiplier({ ...base, aperture: 8 }) / ref - 0.5) < 1e-9);
  assert.ok(Math.abs(computeRelativeExposureMultiplier({ ...base, shutterSpeed: "1/125" }) / ref - 2) < 1e-9);
  assert.ok(Math.abs(computeRelativeExposureMultiplier({ ...base, iso: 800 }) / ref - 2) < 1e-9);
});

test("marcas de paso entero en la escala", () => {
  assert.equal(isFullStopAperture(5.6), true);
  assert.equal(isFullStopAperture(6.3), false);
  assert.equal(isFullStopShutterSeconds(shutterSpeedToSeconds("1/125")), true);
  assert.equal(isFullStopShutterSeconds(shutterSpeedToSeconds("1/100")), false);
});

test("un 50 mm f/1.8 llega a f/1.8 y no a f/1.4", () => {
  const allowed = aperturesForLens(1.8, 22);
  assert.equal(allowed[0], 1.8);
  assert.equal(allowed.at(-1), 22);
  assert.equal(clampApertureToLens(1.4, 1.8, 22), 1.8);
  assert.equal(clampApertureToLens(32, 1.8, 22), 22);
});

test("el 70-300 f/4.5-5.6 cierra su apertura máxima de a tercios al hacer zoom", () => {
  const def = lens("70300f456");
  assert.equal(getMaxApertureAtFocal(def, 70), 4.5);
  assert.equal(getMaxApertureAtFocal(def, 300), 5.6);
  const mid = getMaxApertureAtFocal(def, 185);
  assert.ok([4.5, 5, 5.6].includes(mid));
  let prev = 0;
  for (let f = 70; f <= 300; f += 10) {
    const n = getMaxApertureAtFocal(def, f);
    assert.ok(apertureStops(n) >= prev - 1e-9, `${f} mm`);
    prev = apertureStops(n);
  }
});

test("cada objetivo tiene distancia mínima de enfoque y el macro es el más cercano entre teles", () => {
  assert.equal(lens("50f18").minFocusDistanceM, 0.45);
  assert.ok(lens("100macro28").minFocusDistanceM < lens("85f18").minFocusDistanceM);
  assert.ok(lens("70200f28").minFocusDistanceM >= 1);
});

test("en prioridad de tiempo (S) el diafragma automático no sale del objetivo", () => {
  const range = { maxOpen: 4.5, minAperture: 32 };
  // Escena oscura: la cámara querría abrir a f/1.4, pero el zoom sólo llega a f/4.5.
  const dark = resolveEffectiveSettings({ ...REFERENCE_CAMERA, mode: "S", apertureRange: range }, -4);
  assert.equal(dark.aperture, 4.5);
  const bright = resolveEffectiveSettings({ ...REFERENCE_CAMERA, mode: "S", apertureRange: range }, 8);
  assert.equal(bright.aperture, 32);
});
