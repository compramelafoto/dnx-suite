import type { SimulatorSceneMeta } from "./types";
import { PHOTOGRAPHIC_BLOCK_BOUNDS } from "../assets/photographic-block-manifest";

export const PHOTOGRAPHIC_CITY_SCENE: SimulatorSceneMeta = {
  id: "photographic-city",
  sceneType: "photographic-exterior",
  label: "Ciudad Fotográfica",
  description:
    "Manzana urbana realista (experimental). HDRI por hora, materiales PBR y assets glTF.",
  available: true,
  experimental: true,
  bounds: PHOTOGRAPHIC_BLOCK_BOUNDS,
  spawn: {
    position: [0, 1.65, 10],
    lookAt: [0, 2.2, -14],
  },
  usesNaturalLight: true,
  usesPhotographicPipeline: true,
};
