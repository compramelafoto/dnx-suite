/**
 * Rutas de los modelos y texturas de la Calle 3D (ver scripts/camofduty/fetch-street-assets.mjs).
 */

const BASE = "/camofduty/street";

export const STREET_MODELS = {
  facadeKit: `${BASE}/models/facade-kit.glb`,
  lamp: `${BASE}/models/street-lamp.glb`,
  tree: `${BASE}/models/tree-jacaranda.glb`,
  trash: `${BASE}/models/trash-can.glb`,
  hydrant: `${BASE}/models/fire-hydrant.glb`,
  bench: `${BASE}/models/street-bench.glb`,
  utility: `${BASE}/models/utility-box.glb`,
  manhole: `${BASE}/models/manhole.glb`,
  plant: `${BASE}/models/potted-plant.glb`,
  aircon: `${BASE}/models/aircon.glb`,
  coveredCar: `${BASE}/models/covered-car.glb`,
  treeFar: `${BASE}/models/tree-jacaranda-far.glb`,
} as const;

export type StreetSurface = "asphalt" | "sidewalk" | "curb";

export function streetTexture(surface: StreetSurface, map: "diff" | "nor" | "arm"): string {
  return `${BASE}/textures/${surface}_${map}.webp`;
}
