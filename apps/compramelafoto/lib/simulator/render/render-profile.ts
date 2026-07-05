/**
 * Perfil de render fotográfico — tone mapping y post futuro.
 * Ciudad Fotográfica usa ACES; escenas legacy conservan Linear.
 */

import type { SimulatorSceneId } from "../scenes";
import * as THREE from "three";

export type SimulatorToneMappingMode = "linear" | "aces-filmic";

export interface PhotographicRenderProfile {
  toneMapping: SimulatorToneMappingMode;
  /** Exposición base del renderer (antes del gain de cámara). */
  baseExposure: number;
  /** Bloom deshabilitado por defecto — look foto, no videojuego. */
  bloomEnabled: boolean;
  bloomIntensity: number;
}

const LINEAR_PROFILE: PhotographicRenderProfile = {
  toneMapping: "linear",
  baseExposure: 1,
  bloomEnabled: false,
  bloomIntensity: 0,
};

const PHOTOGRAPHIC_PROFILE: PhotographicRenderProfile = {
  toneMapping: "aces-filmic",
  baseExposure: 1,
  bloomEnabled: false,
  bloomIntensity: 0.12,
};

export function usesPhotographicPipeline(sceneId: SimulatorSceneId): boolean {
  return sceneId === "photographic-city";
}

export function resolveRenderProfile(sceneId: SimulatorSceneId): PhotographicRenderProfile {
  return usesPhotographicPipeline(sceneId) ? PHOTOGRAPHIC_PROFILE : LINEAR_PROFILE;
}

export function resolveThreeToneMapping(mode: SimulatorToneMappingMode): THREE.ToneMapping {
  return mode === "aces-filmic" ? THREE.ACESFilmicToneMapping : THREE.LinearToneMapping;
}

export function applyToneMappingToRenderer(
  renderer: THREE.WebGLRenderer,
  sceneId: SimulatorSceneId,
  exposure: number,
): void {
  const profile = resolveRenderProfile(sceneId);
  renderer.toneMapping = resolveThreeToneMapping(profile.toneMapping);
  renderer.toneMappingExposure = exposure;
}
