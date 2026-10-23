import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeMeasuredEv,
  computePhotoExposureMultiplier,
  computeDslrViewfinderExposureMultiplier,
  DISPLAY_MID_GREY,
  resolveEffectiveSettings,
  SCENE_RENDER_CALIBRATION,
  type SceneLight,
} from "./camera-exposure";
import { shutterSpeedToSeconds } from "./camera-math";
import { REFERENCE_CAMERA, type CameraState } from "./camera-types";
import { meteredEv100, meterLuminance, MID_GREY, type MeterGrid } from "./metering";
import { daylightEv100, sceneBrightnessEv100, STUDIO_EV100 } from "./scene-light";

const W = 48;
const H = 32;

function grid(fill: (x: number, y: number) => number): MeterGrid {
  const luminance = new Float32Array(W * H);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) luminance[y * W + x] = fill(x, y);
  return { width: W, height: H, luminance };
}

const light = (brightness: number, metered = brightness): SceneLight => ({
  brightnessEv100: brightness,
  meteredEv100: metered,
  eyeEv100: metered,
});

const camera = (patch: Partial<CameraState>): CameraState => ({ ...REFERENCE_CAMERA, ...patch });
const SUNNY_16 = camera({ iso: 100, shutterSpeed: "1/125", aperture: 16, mode: "M" });

test("regla del sol 16: ISO 100, 1/125, f/16 con sol pleno da exposición correcta", () => {
  assert.equal(daylightEv100(12 * 60 + 30), 15);
  assert.ok(Math.abs(computeMeasuredEv(SUNNY_16, light(15))) < 0.05);
});

test("una toma bien expuesta deja el gris medio en el gris de pantalla", () => {
  const gain = computePhotoExposureMultiplier(SUNNY_16, light(15)) / SCENE_RENDER_CALIBRATION;
  assert.ok(Math.abs(gain * MID_GREY - DISPLAY_MID_GREY) < 0.01);
});

test("más luz en la escena con los mismos ajustes = sobreexpuesta (y la imagen más clara)", () => {
  assert.ok(computeMeasuredEv(SUNNY_16, light(16)) > 0.9);
  assert.ok(computeMeasuredEv(SUNNY_16, light(14)) < -0.9);
  const bright = computePhotoExposureMultiplier(SUNNY_16, light(16));
  const dim = computePhotoExposureMultiplier(SUNNY_16, light(14));
  assert.ok(Math.abs(bright / dim - 4) < 1e-9);
});

test("el fotómetro sólo mueve la aguja: la foto en M depende de la luz real, no de lo medido", () => {
  const towardSky = computePhotoExposureMultiplier(SUNNY_16, light(15, 17));
  const towardShadow = computePhotoExposureMultiplier(SUNNY_16, light(15, 12));
  assert.equal(towardSky, towardShadow);
  assert.ok(computeMeasuredEv(SUNNY_16, light(15, 17)) > 1.9);
});

test("prioridad de apertura: +1 de compensación duplica el tiempo", () => {
  const a = camera({ mode: "A", iso: 100, aperture: 8 });
  const base = resolveEffectiveSettings(a, light(15));
  const plus = resolveEffectiveSettings({ ...a, exposureCompensation: 1 }, light(15));
  const ratio = shutterSpeedToSeconds(plus.shutterSpeed) / shutterSpeedToSeconds(base.shutterSpeed);
  assert.ok(Math.abs(ratio - 2) < 0.3, `ratio ${ratio}`);
  // Con sol pleno, f/8 a ISO 100 pide 1/500 (sol 16 abierto dos pasos).
  assert.equal(base.shutterSpeed, "1/500");
});

test("los tres modos coinciden ante un cuadro uniforme", () => {
  const g = grid(() => 0.3);
  for (const mode of ["MATRIX", "CENTER", "SPOT"] as const) {
    assert.ok(Math.abs(meterLuminance(g, mode) - 0.3) < 1e-6, mode);
  }
});

test("sujeto claro en el centro sobre fondo oscuro: puntual > central > matricial", () => {
  const g = grid((x, y) => (Math.hypot(x - (W - 1) / 2, y - (H - 1) / 2) <= 4 ? 0.9 : 0.05));
  const spot = meterLuminance(g, "SPOT");
  const center = meterLuminance(g, "CENTER");
  const matrix = meterLuminance(g, "MATRIX");
  assert.ok(Math.abs(spot - 0.9) < 0.05, `spot ${spot}`);
  assert.ok(spot > center && center > matrix, `${spot} ${center} ${matrix}`);
});

test("la matricial no se deja dominar por el sol en una esquina; la central sí sube", () => {
  const g = grid((x, y) => (x < 8 && y < 8 ? 500 : 0.2));
  assert.ok(meterLuminance(g, "MATRIX") < 0.3);
  assert.ok(meterLuminance(g, "CENTER") > 1);
});

test("EV medido: el doble de luminancia en el cuadro es un paso más", () => {
  assert.ok(Math.abs(meteredEv100(15, MID_GREY) - 15) < 1e-9);
  assert.ok(Math.abs(meteredEv100(15, MID_GREY * 2) - 16) < 1e-9);
});

test("la luz del día sigue la hora: atardecer 11, noche 4, estudio fijo", () => {
  assert.equal(daylightEv100(19 * 60 + 30), 11);
  assert.equal(daylightEv100(22 * 60), 4);
  assert.ok(daylightEv100(9 * 60) >= 13.5);
  assert.equal(sceneBrightnessEv100("studio", 3 * 60), sceneBrightnessEv100("studio", 13 * 60));
  assert.equal(STUDIO_EV100, 9);
});

test("de noche el visor óptico se ve más oscuro que de día (el ojo no se adapta del todo)", () => {
  const day = computeDslrViewfinderExposureMultiplier(light(15)) * 2 ** 15;
  const night = computeDslrViewfinderExposureMultiplier(light(4)) * 2 ** 4;
  assert.ok(night < day * 0.5);
});
