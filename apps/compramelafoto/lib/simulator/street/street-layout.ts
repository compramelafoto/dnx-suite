/**
 * Trazado de la Calle 3D — una esquina de barrio de Rosario.
 *
 * Una calle principal a lo largo de Z cruza una transversal a lo largo de X.
 * Calzadas de 8 m, veredas de 3 m con cordón de 15 cm, esquinas con ochava
 * de 3 m y edificios entre medianeras de 6 a 12 m de frente y 2 a 7 pisos.
 * Todo sale de una semilla fija: la calle es siempre la misma (los
 * ejercicios dependen de que lo que se ve en un lugar no cambie).
 */

export type Vec2 = readonly [number, number];

export const STREET = {
  /** Media calzada (m). */
  roadHalf: 4,
  /** Ancho de vereda (m). */
  sidewalk: 3,
  /** Alto del cordón (m). */
  curbHeight: 0.15,
  /** Largo de la calle principal desde la esquina (m). */
  mainLength: 60,
  /** Largo de la transversal desde la esquina (m). */
  crossLength: 36,
  /** Ochava: cateto del corte de esquina (m). */
  chamfer: 3,
  /** Módulo del kit de fachadas (m). */
  module: 3,
  /** Alto de un piso (m). */
  floorHeight: 3,
} as const;

/** Línea de edificación (frente de las fachadas). */
export const BUILDING_LINE = STREET.roadHalf + STREET.sidewalk;

export type UpperWindowStyle =
  | "centered_large_01"
  | "centered_large_02"
  | "centered_double_02"
  | "centered_small_02"
  | "centered_large_03"
  | "offset_small_03";

export type GroundStyle = "shop" | "residential" | "shutter";

export interface StreetBuilding {
  id: string;
  /** Inicio y fin del frente sobre la línea de edificación. */
  start: Vec2;
  end: Vec2;
  /** Normal exterior (hacia la calle). */
  normal: Vec2;
  modules: number;
  floors: number;
  /** Color del revoque (multiplica la textura). */
  tint: string;
  upperWindows: UpperWindowStyle;
  ground: GroundStyle[];
  /** Fracción de ventanas con luz de noche. */
  nightLitFraction: number;
  /** Es el edificio de esquina (comparte altura con la ochava). */
  corner: boolean;
}

export interface StreetCorner {
  id: string;
  /** Extremos de la ochava: sobre la calle principal y sobre la transversal. */
  onMain: Vec2;
  onCross: Vec2;
  normal: Vec2;
  floors: number;
  tint: string;
  upperWindows: UpperWindowStyle;
}

export type PropKind =
  | "lamp"
  | "tree"
  | "trash"
  | "hydrant"
  | "bench"
  | "utility"
  | "manhole"
  | "plant"
  | "aircon"
  | "car"
  | "covered-car";

export interface StreetProp {
  kind: PropKind;
  position: readonly [number, number, number];
  rotationY: number;
}

/** Rectángulo que no se puede atravesar caminando (x/z mínimos y máximos). */
export interface CollisionRect {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

/** Recorrido cerrado de un peatón (del último punto vuelve al primero). */
export interface WalkPath {
  id: string;
  points: readonly Vec2[];
  /** Velocidad al caminar (m/s). */
  speed: number;
}

export interface StreetLayout {
  buildings: StreetBuilding[];
  corners: StreetCorner[];
  props: StreetProp[];
  colliders: CollisionRect[];
  walkPaths: WalkPath[];
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
}

/** Revoques típicos de un barrio: beige, crema, gris, terracota suave, blanco. */
const TINTS = ["#e8dcc6", "#f1e7d0", "#d9d4cc", "#e6c9b1", "#f4f1ea", "#d8c3a0", "#cfd3d6", "#efd8bd"];

const UPPER_STYLES: UpperWindowStyle[] = [
  "centered_large_01",
  "centered_large_02",
  "centered_double_02",
  "centered_small_02",
  "centered_large_03",
  "offset_small_03",
];

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

function randomFloors(rand: () => number): number {
  // Más edificios bajos y medianos que altos, como en un barrio.
  const r = rand();
  if (r < 0.15) return 2;
  if (r < 0.45) return 3;
  if (r < 0.7) return 4;
  if (r < 0.88) return 5;
  if (r < 0.96) return 6;
  return 7;
}

function groundFor(rand: () => number, modules: number): GroundStyle[] {
  const shop = rand() < 0.55;
  return Array.from({ length: modules }, (_, i) => {
    if (!shop) return i === Math.floor(modules / 2) ? "residential" : "shutter";
    return rand() < 0.2 ? "shutter" : "shop";
  });
}

/**
 * Parte un frente en lotes de 2 a 4 módulos (6 a 12 m). El primero es el
 * edificio de esquina.
 */
function buildFront(
  rand: () => number,
  id: string,
  origin: Vec2,
  dir: Vec2,
  normal: Vec2,
  totalModules: number,
  corner: StreetCorner,
): StreetBuilding[] {
  const out: StreetBuilding[] = [];
  let offset = 0;
  let index = 0;
  while (offset < totalModules) {
    const left = totalModules - offset;
    let modules = Math.min(left, 2 + Math.floor(rand() * 3));
    if (left - modules === 1) modules += 1;
    const isCorner = index === 0;
    const startD = offset * STREET.module;
    const endD = (offset + modules) * STREET.module;
    out.push({
      id: `${id}-${index}`,
      start: [origin[0] + dir[0] * startD, origin[1] + dir[1] * startD],
      end: [origin[0] + dir[0] * endD, origin[1] + dir[1] * endD],
      normal,
      modules,
      floors: isCorner ? corner.floors : randomFloors(rand),
      tint: isCorner ? corner.tint : pick(rand, TINTS),
      upperWindows: isCorner ? corner.upperWindows : pick(rand, UPPER_STYLES),
      ground: groundFor(rand, modules),
      nightLitFraction: 0.15 + rand() * 0.45,
      corner: isCorner,
    });
    offset += modules;
    index += 1;
  }
  return out;
}

export function buildStreetLayout(seed = 2026): StreetLayout {
  const rand = seededRandom(seed);
  const L = BUILDING_LINE;
  const c = STREET.chamfer;
  const mainModules = Math.floor((STREET.mainLength - L - c) / STREET.module);
  const crossModules = Math.floor((STREET.crossLength - L - c) / STREET.module);

  const buildings: StreetBuilding[] = [];
  const corners: StreetCorner[] = [];

  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      const id = `q${sx > 0 ? "e" : "o"}${sz > 0 ? "s" : "n"}`;
      const corner: StreetCorner = {
        id: `${id}-ochava`,
        onMain: [sx * L, sz * (L + c)],
        onCross: [sx * (L + c), sz * L],
        normal: [-sx * Math.SQRT1_2, -sz * Math.SQRT1_2],
        floors: 4 + Math.floor(rand() * 3),
        tint: pick(rand, TINTS),
        upperWindows: pick(rand, UPPER_STYLES),
      };
      corners.push(corner);
      // Frente sobre la calle principal: avanza en Z alejándose de la esquina.
      buildings.push(
        ...buildFront(rand, `${id}-main`, corner.onMain, [0, sz], [-sx, 0], mainModules, corner),
      );
      // Frente sobre la transversal: avanza en X alejándose de la esquina.
      buildings.push(
        ...buildFront(rand, `${id}-cross`, corner.onCross, [sx, 0], [0, -sz], crossModules, corner),
      );
    }
  }

  const props: StreetProp[] = [];
  const curbInset = STREET.roadHalf + 0.55;
  // Faroles y árboles sobre el borde de la vereda, alternados.
  for (const sx of [1, -1] as const) {
    for (let z = -STREET.mainLength + 6; z <= STREET.mainLength - 6; z += 6) {
      // Cerca de la esquina no hay árboles: la ochava queda a la vista.
      if (Math.abs(z) < L + 8) continue;
      const k = Math.round(z / 6);
      if (k % 4 === 0) props.push({ kind: "lamp", position: [sx * curbInset, STREET.curbHeight, z], rotationY: sx > 0 ? Math.PI : 0 });
      else if (k % 2 === 0) props.push({ kind: "tree", position: [sx * (STREET.roadHalf + 0.9), STREET.curbHeight, z + 3 * sx], rotationY: rand() * Math.PI * 2 });
    }
  }
  for (const sz of [1, -1] as const) {
    for (let x = L + 6; x <= STREET.crossLength - 4; x += 8) {
      for (const sx of [1, -1] as const) {
        props.push({ kind: (x / 8) % 2 < 1 ? "tree" : "lamp", position: [sx * x, STREET.curbHeight, sz * (STREET.roadHalf + 0.9)], rotationY: rand() * Math.PI * 2 });
      }
    }
  }
  // Mobiliario de esquina y alguna boca de incendio.
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      props.push({ kind: "trash", position: [sx * (STREET.roadHalf + 0.6), STREET.curbHeight, sz * (L + 1.2)], rotationY: 0 });
    }
  }
  props.push({ kind: "hydrant", position: [STREET.roadHalf + 0.5, STREET.curbHeight, 21], rotationY: 0 });
  props.push({ kind: "hydrant", position: [-(STREET.roadHalf + 0.5), STREET.curbHeight, -33], rotationY: Math.PI });
  props.push({ kind: "bench", position: [-(L - 0.6), STREET.curbHeight, 28], rotationY: Math.PI / 2 });
  props.push({ kind: "bench", position: [L - 0.6, STREET.curbHeight, -26], rotationY: -Math.PI / 2 });
  props.push({ kind: "utility", position: [L - 0.4, STREET.curbHeight, 40], rotationY: -Math.PI / 2 });
  props.push({ kind: "manhole", position: [1.2, 0.005, 16], rotationY: 0 });
  props.push({ kind: "manhole", position: [-1.4, 0.005, -24], rotationY: 0 });
  // Autos estacionados contra el cordón izquierdo (Rosario: calles de una mano).
  for (const z of [-46, -31, 18, 33, 49]) {
    // Algunos con funda: en la cuadra siempre hay alguno guardado así.
    const covered = z === -31 || z === 33;
    props.push({ kind: covered ? "covered-car" : "car", position: [-(STREET.roadHalf - 1.15), 0, z], rotationY: 0 });
  }

  // No se puede entrar a las manzanas: un rectángulo por cuadrante detrás de la línea.
  const far = 80;
  const colliders: CollisionRect[] = [];
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      const xs = [sx * L, sx * far].sort((a, b) => a - b);
      const zs = [sz * (L + c), sz * far].sort((a, b) => a - b);
      colliders.push({ xMin: xs[0], xMax: xs[1], zMin: zs[0], zMax: zs[1] });
      const xs2 = [sx * (L + c), sx * far].sort((a, b) => a - b);
      const zs2 = [sz * L, sz * far].sort((a, b) => a - b);
      colliders.push({ xMin: xs2[0], xMax: xs2[1], zMin: zs2[0], zMax: zs2[1] });
    }
  }

  // Recorridos cerrados: nadie da media vuelta ni desaparece. Se camina por la
  // vereda, se cruza por la senda (que continúa la vereda, entre el cordón y la
  // línea de edificación) y, lejos de la esquina, a veces a mitad de cuadra.
  const band = STREET.roadHalf + STREET.sidewalk / 2;
  const far1 = STREET.mainLength - 10;
  const far2 = STREET.mainLength - 14;
  const crossFar = STREET.crossLength - 6;
  const walkPaths: WalkPath[] = [
    {
      id: "vuelta-larga-este",
      points: [[band, -far1], [band, far1], [-band, far1], [-band, -far1]],
      speed: 1.35,
    },
    {
      id: "vuelta-larga-oeste",
      points: [[-(band + 0.5), far2], [-(band + 0.5), -far2], [band + 0.5, -far2], [band + 0.5, far2]],
      speed: 1.3,
    },
    {
      id: "vuelta-transversal",
      points: [[-crossFar, band + 0.5], [crossFar, band + 0.5], [crossFar, -(band + 0.5)], [-crossFar, -(band + 0.5)]],
      speed: 1.4,
    },
    {
      id: "vuelta-esquina",
      points: [[band - 0.5, band - 0.5], [-(band - 0.5), band - 0.5], [-(band - 0.5), -(band - 0.5)], [band - 0.5, -(band - 0.5)]],
      speed: 1.25,
    },
  ];

  return {
    buildings,
    corners,
    props,
    colliders,
    walkPaths,
    bounds: {
      xMin: -STREET.crossLength + 1,
      xMax: STREET.crossLength - 1,
      zMin: -STREET.mainLength + 1,
      zMax: STREET.mainLength - 1,
    },
  };
}

/** Empuja un punto fuera de los rectángulos de colisión (radio del caminante). */
export function resolveStreetCollision(
  x: number,
  z: number,
  colliders: readonly CollisionRect[],
  radius = 0.35,
): [number, number] {
  let px = x;
  let pz = z;
  for (const r of colliders) {
    if (px < r.xMin - radius || px > r.xMax + radius || pz < r.zMin - radius || pz > r.zMax + radius) {
      continue;
    }
    const pushes = [
      { d: px - (r.xMin - radius), ax: "x" as const, v: r.xMin - radius },
      { d: r.xMax + radius - px, ax: "x" as const, v: r.xMax + radius },
      { d: pz - (r.zMin - radius), ax: "z" as const, v: r.zMin - radius },
      { d: r.zMax + radius - pz, ax: "z" as const, v: r.zMax + radius },
    ];
    const best = pushes.reduce((a, b) => (b.d < a.d ? b : a));
    if (best.ax === "x") px = best.v;
    else pz = best.v;
  }
  return [px, pz];
}

/** Altura del piso: la vereda está 15 cm sobre la calzada. */
export function streetGroundHeight(x: number, z: number): number {
  return Math.abs(x) >= STREET.roadHalf && Math.abs(z) >= STREET.roadHalf ? STREET.curbHeight : 0;
}
