/**
 * Estimación de luminancia por escena — Cam Of Duty.
 */

import type { SunState } from "./natural-light";
import type { SimulatorSceneId } from "./scenes";

function clampMeterEv(ev: number): number {
  return Math.max(-3, Math.min(3, ev));
}

export function estimateStudioLuminanceEv(x: number, z: number): number {
  const brightDist = Math.hypot(x - 6.5, z - 1.5);
  const darkDist = Math.hypot(x + 7, z + 3);
  let ev = 0;
  if (brightDist < 6) ev += 2.2 * (1 - brightDist / 6);
  if (darkDist < 5) ev -= 2.2 * (1 - darkDist / 5);
  return clampMeterEv(ev);
}

export function estimateCityLuminanceEv(x: number, z: number, sun: SunState): number {
  let ev = sun.luminanceEvOffset;

  const onSidewalk = Math.abs(x) > 4.2;
  const inOpenStreet = Math.abs(x) < 2.5;
  const facingSun = z < 0 ? 0.25 : -0.1;

  if (inOpenStreet && sun.sunVisible) ev += 0.45;
  if (onSidewalk && sun.sunVisible) ev -= 0.35;
  if (!sun.sunVisible) ev -= 0.5;

  ev += facingSun * (sun.sunVisible ? 0.3 : 0);
  if (Math.abs(x) > 10) ev -= 0.6;

  return clampMeterEv(ev);
}

export function estimatePhotographicCityLuminanceEv(x: number, z: number, sun: SunState): number {
  let ev = sun.luminanceEvOffset;

  const inOpenPlaza = Math.abs(x) < 8 && z > -4 && z < 10;
  const nearWaterfront = z < -6;
  const inBuildingShadow = Math.abs(x) > 14;

  if (inOpenPlaza && sun.sunVisible) ev += 0.55;
  if (nearWaterfront && sun.sunVisible) ev += 0.25;
  if (inBuildingShadow) ev -= 0.45;
  if (!sun.sunVisible) ev -= 0.35;

  return clampMeterEv(ev);
}

export function estimateSceneLuminanceForScene(
  sceneId: SimulatorSceneId,
  x: number,
  z: number,
  sun: SunState,
): number {
  if (sceneId === "photographic-city") return estimatePhotographicCityLuminanceEv(x, z, sun);
  if (sceneId === "city") return estimateCityLuminanceEv(x, z, sun);
  return estimateStudioLuminanceEv(x, z);
}
