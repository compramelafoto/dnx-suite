import type { SimulatorSceneMeta } from "./types";

export const CITY_SCENE: SimulatorSceneMeta = {
  id: "city",
  sceneType: "exterior",
  label: "Ciudad exterior",
  description: "Prototipo técnico (primitivas). Calle urbana con luz natural variable.",
  available: true,
  bounds: { xMin: -14, xMax: 14, zMin: -28, zMax: 28 },
  spawn: {
    position: [3.2, 1.65, 22],
    lookAt: [0, 1.5, -8],
  },
  usesNaturalLight: true,
};

/** Calle principal (eje Z). */
export const CITY_STREET = {
  width: 9,
  length: 56,
  sidewalkWidth: 3.2,
} as const;
