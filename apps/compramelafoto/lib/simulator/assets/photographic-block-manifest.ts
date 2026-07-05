/**
 * Manifiesto de la primera manzana fotográfica — Puerto Norte / costanera Rosario.
 * Slots glTF vacíos hasta que se agreguen archivos en public/camofduty/assets/.
 */

import type { CodAssetCategory } from "./paths";

export type PhotographicAssetKind =
  | "building"
  | "surface"
  | "vehicle"
  | "vegetation"
  | "pedestrian"
  | "prop";

export interface PhotographicAssetSlot {
  id: string;
  label: string;
  /** Carpeta de assets en public/camofduty/assets/. */
  category: CodAssetCategory;
  /** Tipo semántico del slot. */
  kind: PhotographicAssetKind;
  /** Nombre de archivo dentro de la carpeta de categoría; null = no cargar aún. */
  filename: string | null;
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  rotationY?: number;
  scale?: number | readonly [number, number, number];
  castShadow: boolean;
  receiveShadow: boolean;
  /** Alinear base del bounding box a y=0 tras cargar. */
  groundAlign?: boolean;
  /** Sujeto AF estático (peatón sentado / de pie sin movimiento). */
  focusSubjectId?: string;
  /** Movimiento lateral (vehículos en calle). */
  motion?: PhotographicVehicleMotion;
}

export interface PhotographicVehicleMotion {
  subjectId: string;
  axis: "x" | "z";
  min: number;
  max: number;
  fixedZ?: number;
  fixedX?: number;
  /** Sentido inicial del recorrido (+1 o −1). */
  initialDirection?: 1 | -1;
}

/** Límites de la manzana (metros, origen en centro de calle). */
export const PHOTOGRAPHIC_BLOCK_BOUNDS = {
  xMin: -22,
  xMax: 22,
  zMin: -18,
  zMax: 18,
} as const;

/**
 * Slots preparados para importación glTF.
 * Completar `filename` cuando el asset esté en disco.
 */
export const PHOTOGRAPHIC_BLOCK_SLOTS: readonly PhotographicAssetSlot[] = [
  // Fachadas norte (costanera / río)
  {
    id: "facade-north-a",
    label: "Fachada norte A",
    category: "buildings",
    kind: "building",
    filename: "block-a-north-a.glb",
    position: [0, 0, -14],
    rotation: [0, 0, 0],
    scale: 1,
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
  },
  {
    id: "facade-north-b",
    label: "Fachada norte B",
    category: "buildings",
    kind: "building",
    filename: "block-a-north-b.glb",
    position: [12, 0, -14],
    rotation: [0, 0, 0],
    scale: 1,
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
  },
  {
    id: "facade-north-c",
    label: "Fachada norte C",
    category: "buildings",
    kind: "building",
    filename: null,
    position: [-12, 0, -14],
    rotationY: 0,
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
  },
  // Fachadas sur (calle principal)
  {
    id: "facade-south-a",
    label: "Fachada sur A",
    category: "buildings",
    kind: "building",
    filename: null,
    position: [-12, 0, 14],
    rotationY: Math.PI,
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
  },
  {
    id: "facade-south-b",
    label: "Fachada sur B",
    category: "buildings",
    kind: "building",
    filename: null,
    position: [0, 0, 14],
    rotationY: Math.PI,
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
  },
  {
    id: "facade-south-c",
    label: "Fachada sur C",
    category: "buildings",
    kind: "building",
    filename: null,
    position: [12, 0, 14],
    rotationY: Math.PI,
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
  },
  // Superficie urbana — calzada primero (render bajo fachadas)
  {
    id: "street-asphalt",
    label: "Calzada (asfalto + vereda + cordón)",
    category: "surfaces",
    kind: "surface",
    filename: "street-asphalt.glb",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
    castShadow: false,
    receiveShadow: true,
    groundAlign: true,
  },
  {
    id: "sidewalk-east",
    label: "Vereda este",
    category: "surfaces",
    kind: "surface",
    filename: null,
    position: [10, 0, 0],
    castShadow: false,
    receiveShadow: true,
  },
  {
    id: "sidewalk-west",
    label: "Vereda oeste",
    category: "surfaces",
    kind: "surface",
    filename: null,
    position: [-10, 0, 0],
    castShadow: false,
    receiveShadow: true,
  },
  // Vehículo en movimiento (glTF real — ver PhotographicMovingVehicle)
  {
    id: "vehicle-main",
    label: "Auto principal",
    category: "vehicles",
    kind: "vehicle",
    filename: "car-main.glb",
    position: [-8, 0, 2],
    rotation: [0, Math.PI / 2, 0],
    scale: 1,
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
    motion: {
      subjectId: "vehicle-main",
      axis: "x",
      min: -10,
      max: 10,
      fixedZ: 2,
    },
  },
  // Peatón en movimiento (glTF real — ver PhotographicMovingPedestrian)
  {
    id: "pedestrian-main",
    label: "Peatón principal",
    category: "pedestrians",
    kind: "pedestrian",
    filename: "pedestrian-main.glb",
    position: [4, 0, -2],
    rotation: [0, Math.PI, 0],
    scale: 1,
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
    motion: {
      subjectId: "pedestrian-main",
      axis: "z",
      min: -6,
      max: 6,
      fixedX: 4,
      initialDirection: 1,
    },
  },
  {
    id: "pedestrian-02",
    label: "Peatón vereda oeste",
    category: "pedestrians",
    kind: "pedestrian",
    filename: "pedestrian-02.glb",
    position: [-4, 0, 3],
    rotation: [0, 0, 0],
    scale: 1.15,
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
    motion: {
      subjectId: "pedestrian-02",
      axis: "z",
      min: -5,
      max: 5,
      fixedX: -4,
      initialDirection: -1,
    },
  },
  {
    id: "bench-east-01",
    label: "Banco vereda este",
    category: "props",
    kind: "prop",
    filename: "bench-east.glb",
    position: [4.38, 0, 5],
    rotation: [0, Math.PI / 2, 0],
    scale: 1,
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
  },
  {
    id: "pedestrian-seated-bench",
    label: "Peatón sentado (banco)",
    category: "pedestrians",
    kind: "pedestrian",
    filename: "pedestrian-seated.glb",
    position: [3.72, 0, 5],
    rotation: [0, Math.PI / 2, 0],
    scale: 1,
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
    focusSubjectId: "pedestrian-seated",
  },
  {
    id: "vegetation-tree-01",
    label: "Árbol vereda",
    category: "vegetation",
    kind: "vegetation",
    filename: null,
    position: [-8, 0, 8],
    castShadow: true,
    receiveShadow: true,
    groundAlign: true,
  },
] as const;

export const PHOTOGRAPHIC_VEHICLE_MAIN_SLOT = PHOTOGRAPHIC_BLOCK_SLOTS.find(
  (s) => s.id === "vehicle-main",
)!;

export const PHOTOGRAPHIC_PEDESTRIAN_MAIN_SLOT = PHOTOGRAPHIC_BLOCK_SLOTS.find(
  (s) => s.id === "pedestrian-main",
)!;

export const PHOTOGRAPHIC_PEDESTRIAN_SECONDARY_SLOT = PHOTOGRAPHIC_BLOCK_SLOTS.find(
  (s) => s.id === "pedestrian-02",
)!;

/** Slots de peatones con movimiento (instancias PhotographicMovingPedestrian). */
export const PHOTOGRAPHIC_PEDESTRIAN_SLOTS = PHOTOGRAPHIC_BLOCK_SLOTS.filter(
  (slot): slot is PhotographicAssetSlot & { motion: PhotographicVehicleMotion } =>
    slot.kind === "pedestrian" && slot.motion != null,
);

/** Slots de peatones estáticos (retrato ambiental, AF-S). */
export const PHOTOGRAPHIC_STATIC_PEDESTRIAN_SLOTS = PHOTOGRAPHIC_BLOCK_SLOTS.filter(
  (slot): slot is PhotographicAssetSlot & { focusSubjectId: string } =>
    slot.kind === "pedestrian" && slot.motion == null && slot.focusSubjectId != null,
);

export const PHOTOGRAPHIC_PEDESTRIAN_SEATED_SLOT = PHOTOGRAPHIC_BLOCK_SLOTS.find(
  (s) => s.id === "pedestrian-seated-bench",
)!;

export const PHOTOGRAPHIC_FACADE_NORTH_B_SLOT = PHOTOGRAPHIC_BLOCK_SLOTS.find(
  (s) => s.id === "facade-north-b",
)!;
