import type { SimulatorSceneMeta } from "./types";
import { buildStreetLayout } from "../street/street-layout";

const STREET_BOUNDS = buildStreetLayout().bounds;

/**
 * Calle 3D: una esquina de barrio de Rosario con edificios, veredas, luz por
 * hora y peatones. Conserva el id "photographic-city" de la escena anterior.
 */
export const PHOTOGRAPHIC_CITY_SCENE: SimulatorSceneMeta = {
  id: "photographic-city",
  sceneType: "photographic-exterior",
  label: "Calle",
  description: "Esquina de barrio en 3D: edificios, veredas, faroles, árboles y gente caminando. Luz según la hora.",
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
