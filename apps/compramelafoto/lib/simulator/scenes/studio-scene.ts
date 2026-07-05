import type { SimulatorSceneMeta } from "./types";

export const STUDIO_SCENE: SimulatorSceneMeta = {
  id: "studio",
  sceneType: "studio",
  label: "Estudio",
  description: "Estudio fotográfico con zonas de luz y sombra controladas.",
  available: true,
  bounds: { xMin: -10, xMax: 10, zMin: -8, zMax: 10 },
  spawn: {
    position: [0, 1.65, 7],
    lookAt: [0, 1.35, -2],
  },
  usesNaturalLight: false,
};
