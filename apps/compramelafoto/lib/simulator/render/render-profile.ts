/**
 * Perfil de render fotográfico — tone mapping y post futuro.
 * La Calle 3D usa ACES Filmic.
 */

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

const PHOTOGRAPHIC_PROFILE: PhotographicRenderProfile = {
  toneMapping: "aces-filmic",
  baseExposure: 1,
  bloomEnabled: false,
  bloomIntensity: 0.12,
};

export function resolveRenderProfile(): PhotographicRenderProfile {
  return PHOTOGRAPHIC_PROFILE;
}

export function resolveThreeToneMapping(mode: SimulatorToneMappingMode): THREE.ToneMapping {
  return mode === "aces-filmic" ? THREE.ACESFilmicToneMapping : THREE.LinearToneMapping;
}

export function applyToneMappingToRenderer(
  renderer: THREE.WebGLRenderer,
  exposure: number,
): void {
  const profile = resolveRenderProfile();
  renderer.toneMapping = resolveThreeToneMapping(profile.toneMapping);
  renderer.toneMappingExposure = exposure;
}
