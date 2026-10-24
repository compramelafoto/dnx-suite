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
  statue: `${BASE}/models/statue.glb`,
  plazaBench: `${BASE}/models/plaza-bench.glb`,
  shrub: `${BASE}/models/shrub.glb`,
  coffeeCart: `${BASE}/models/coffee-cart.glb`,
  cafeTable: `${BASE}/models/cafe-table.glb`,
  monobloc: `${BASE}/models/monobloc.glb`,
  crate: `${BASE}/models/crate.glb`,
  trashbag: `${BASE}/models/trashbag.glb`,
  cardboard: `${BASE}/models/cardboard.glb`,
  barrel: `${BASE}/models/barrel.glb`,
  wallLamp: `${BASE}/models/wall-lamp.glb`,
  cables: `${BASE}/models/cables.glb`,
  shutterDoor: `${BASE}/models/rollershutter-door.glb`,
  planter: `${BASE}/models/planter.glb`,
  rat: `${BASE}/models/rat.glb`,
} as const;

export type StreetSurface = "asphalt" | "sidewalk" | "curb" | "grass" | "bricks" | "cobbles";

export function streetTexture(surface: StreetSurface, map: "diff" | "nor" | "arm"): string {
  return `${BASE}/textures/${surface}_${map}.webp`;
}
