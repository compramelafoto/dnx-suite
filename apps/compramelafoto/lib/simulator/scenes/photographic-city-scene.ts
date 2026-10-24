import type { SimulatorSceneMeta } from "./types";
import { buildStreetLayout } from "../street/street-layout";

const STREET_BOUNDS = buildStreetLayout().bounds;

/**
 * Calle 3D: un barrio de Rosario de 3 × 3 manzanas con plaza, casas, centro y
 * pasajes, luz por hora, tránsito y peatones. Conserva el id
 * "photographic-city" de la escena anterior.
 */
export const PHOTOGRAPHIC_CITY_SCENE: SimulatorSceneMeta = {
  id: "photographic-city",
  sceneType: "photographic-exterior",
  label: "Calle",
  description: "Barrio en 3D de 9 manzanas: centro, casas, plaza con monumento y fuente, pasajes, tránsito y gente caminando. Luz según la hora.",
  available: true,
  experimental: true,
  bounds: STREET_BOUNDS,
  spawn: {
    position: [5.8, 1.65, -13],
    lookAt: [-6, 3, 14],
  },
  usesNaturalLight: true,
  usesPhotographicPipeline: true,
};
