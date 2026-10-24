/**
 * Trazado de la Calle 3D — un barrio de Rosario de 3 × 3 manzanas.
 *
 * Calles en cuadrícula cada 101 m (calzadas de 8 m, veredas de 3 m con cordón
 * de 15 cm, esquinas con ochava de 3 m): así cada frente de manzana mide un
 * número entero de módulos del kit de fachadas. Cada manzana tiene su
 * carácter (centro con edificios altos y locales, casas bajas, uso mixto, la
 * plaza) y algunas tienen un pasaje que las cruza. Alrededor hay un anillo de
 * manzanas que cierra la vista y se pierde en la bruma.
 *
 * Todo sale de una semilla fija: la ciudad es siempre la misma (los
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
  /** Ochava: cateto del corte de esquina (m). */
  chamfer: 3,
  /** Módulo del kit de fachadas (m). */
  module: 3,
  /** Alto de un piso (m). */
  floorHeight: 3,
} as const;

/** Distancia de la línea de edificación al eje de la calle. */
export const BUILDING_LINE = STREET.roadHalf + STREET.sidewalk;

export const CITY = {
  /** Distancia entre ejes de calles (m): 101 deja frentes de 27 módulos entre ochavas. */
  pitch: 101,
  /** Ejes de las calles: x de las que corren a lo largo de Z; z de las que corren a lo largo de X. */
  lines: [-101, 0, 101, 202] as readonly number[],
  /** Hasta dónde se puede caminar por las calles que salen del barrio (m). */
  reach: [-150, 251] as const,
  /** Manzanas visitables por lado (las del anillo sólo se ven). */
  blocks: 3,
} as const;

export type UpperWindowStyle =
  | "centered_large_01"
  | "centered_large_02"
  | "centered_double_02"
  | "centered_small_02"
  | "centered_large_03"
  | "offset_small_03";

export type GroundStyle = "shop" | "residential" | "shutter";

/** Carácter de una manzana. */
export type BlockKind = "centro" | "casas" | "mixto" | "plaza";

export interface CityBlock {
  id: string;
  kind: BlockKind;
  /** Índices en la cuadrícula (0…2 adentro; −1 y 3 son el anillo). */
  ix: number;
  iz: number;
  /** Línea de edificación (rectángulo donde van los edificios). */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Del anillo: sólo se ve, no se camina alrededor. */
  ring: boolean;
  /** Pasaje que cruza la manzana, si tiene. */
  alley: Alley | null;
}

/** Pasaje peatonal que atraviesa una manzana de lado a lado. */
export interface Alley {
  /** Eje por el que se camina el pasaje. */
  axis: "x" | "z";
  /** Coordenada del centro del pasaje (z si corre en X, x si corre en Z). */
  at: number;
  /** Ancho entre paredes (m). */
  width: number;
  /** Extremos (sobre la línea de edificación). */
  from: number;
  to: number;
}

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
  /** Manzana a la que pertenece: se dibuja (o no) junto con ella. */
  chunk: string;
}

export interface StreetCorner {
  id: string;
  /** Extremos de la ochava: sobre el frente que corre en Z y sobre el que corre en X. */
  onMain: Vec2;
  onCross: Vec2;
  normal: Vec2;
  floors: number;
  tint: string;
  upperWindows: UpperWindowStyle;
  chunk: string;
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
  | "covered-car"
  | "statue"
  | "plaza-lamp"
  | "plaza-bench"
  | "plaza-bench-forjado"
  | "shrub"
  | "coffee-cart"
  | "cafe-table"
  | "monobloc"
  | "crate"
  | "trashbag"
  | "cardboard"
  | "barrel"
  | "wall-lamp"
  | "cables"
  | "shutter-door"
  | "planter"
  | "rat";

export interface StreetProp {
  kind: PropKind;
  position: readonly [number, number, number];
  rotationY: number;
  /** Escala uniforme (1 si no se indica). */
  scale?: number;
}

/** Calle: eje y dónde empieza y termina (fuera del barrio, dentro de la bruma). */
export interface StreetLine {
  id: string;
  /** Eje por el que corre la calle. */
  axis: "x" | "z";
  /** Coordenada del eje (x si corre en Z, z si corre en X). */
  at: number;
  from: number;
  to: number;
  /** Adoquines en vez de asfalto (las calles viejas del barrio de casas). */
  cobbled: boolean;
}

/** Algo pintado o tirado en el piso (charcos, hojas, parches, rayuela…). */
export type GroundDecalKind = "puddle" | "leaves" | "petals" | "patch" | "oil" | "chalk" | "drain" | "arrow" | "stencil";

export interface GroundDecal {
  kind: GroundDecalKind;
  /** Centro (y = altura del piso donde va). */
  position: readonly [number, number, number];
  /** Ancho y largo (m). */
  size: Vec2;
  rotationY: number;
  /** Variante del dibujo (cada tipo tiene varias). */
  variant: number;
}

/** Algo pegado o pintado en una pared (grafitis, afiches). */
export type WallDecalKind = "graffiti" | "poster";

export interface WallDecal {
  kind: WallDecalKind;
  position: readonly [number, number, number];
  /** Ancho y alto (m). */
  size: Vec2;
  /** Hacia dónde mira la cara (rotation.y de un plano que mira a +Z). */
  rotationY: number;
  variant: number;
}

/** Bar con luces de neón en un pasaje: vidriera, cartel y mesas afuera (para fotos nocturnas). */
export interface NeonBar {
  /** Centro del frente, sobre la pared (a nivel de la vereda). */
  center: Vec2;
  /** Hacia dónde mira el frente (hacia el pasaje). */
  normal: Vec2;
  /** Dirección a lo largo de la pared. */
  along: Vec2;
  /** Ancho del frente (m). */
  width: number;
}

/** Pared lisa (fondo de un pasaje, muro de la plaza). */
export interface PlainWall {
  start: Vec2;
  end: Vec2;
  height: number;
  /** Espesor hacia atrás de la cara (m). */
  thickness: number;
  normal: Vec2;
  tint: string;
  chunk: string;
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

/** La plaza: césped, senderos, monumento y fuente. */
export interface Plaza {
  block: CityBlock;
  /** Centro y radio del círculo del monumento. */
  center: Vec2;
  monumentRadius: number;
  /** Fuente: centro y radio. */
  fountain: { center: Vec2; radius: number };
  /** Mástil de la bandera, respecto del centro: detrás del monumento (que mira al noroeste). */
  flagOffset: Vec2;
  /** Senderos (tramos rectos con ancho). */
  paths: { from: Vec2; to: Vec2; width: number }[];
}

export interface StreetLayout {
  blocks: CityBlock[];
  streets: StreetLine[];
  buildings: StreetBuilding[];
  corners: StreetCorner[];
  walls: PlainWall[];
  props: StreetProp[];
  groundDecals: GroundDecal[];
  wallDecals: WallDecal[];
  plaza: Plaza;
  neonBar: NeonBar | null;
  colliders: CollisionRect[];
  walkPaths: WalkPath[];
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
}

/** Revoques típicos del centro: beige, crema, gris, terracota suave, blanco. */
const TINTS = ["#e8dcc6", "#f1e7d0", "#d9d4cc", "#e6c9b1", "#f4f1ea", "#d8c3a0", "#cfd3d6", "#efd8bd"];
/** Casas: colores más vivos (verde agua, celeste, amarillo, salmón, rosa viejo). */
const HOUSE_TINTS = ["#cfe3d4", "#c9dbe8", "#f0dc9c", "#f0c3a8", "#e3c0c4", "#e8e0c8", "#d6e6c2", "#f2d2b0", "#c8c8d8"];

const UPPER_STYLES: UpperWindowStyle[] = [
  "centered_large_01",
  "centered_large_02",
  "centered_double_02",
  "centered_small_02",
  "centered_large_03",
  "offset_small_03",
];

/** Carácter de cada manzana visitable (fila = iz, columna = ix). */
const BLOCK_KINDS: BlockKind[][] = [
  ["centro", "centro", "mixto"],
  ["casas", "plaza", "centro"],
  ["casas", "casas", "mixto"],
];

/** Manzanas con pasaje: la mixta del sur lo tiene a lo largo de X; la casas del noroeste, a lo largo de Z. */
const ALLEYS: Record<string, "x" | "z"> = { "m2-0": "x", "m0-2": "z" };
/** El bar de neón: en el pasaje de la manzana mixta, sobre la medianera alta del lado sur. */
const NEON_BAR_BLOCK = "m2-0";
const NEON_BAR_WIDTH = 7;

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

function randomFloors(rand: () => number, kind: BlockKind): number {
  const r = rand();
  if (kind === "casas") return r < 0.7 ? 1 : 2;
  if (kind === "mixto") return r < 0.25 ? 1 : r < 0.6 ? 2 : r < 0.85 ? 3 : 4;
  // Centro: más edificios medianos que altos.
  if (r < 0.1) return 2;
  if (r < 0.3) return 3;
  if (r < 0.55) return 4;
  if (r < 0.75) return 5;
  if (r < 0.88) return 6;
  if (r < 0.96) return 7;
  return 8;
}

function groundFor(rand: () => number, modules: number, kind: BlockKind): GroundStyle[] {
  const shopChance = kind === "centro" ? 0.65 : kind === "mixto" ? 0.4 : 0.12;
  const shop = rand() < shopChance;
  return Array.from({ length: modules }, (_, i) => {
    if (!shop) return i === Math.floor(modules / 2) ? "residential" : rand() < 0.35 ? "shutter" : "residential";
    return rand() < 0.2 ? "shutter" : "shop";
  });
}

function lotModules(rand: () => number, kind: BlockKind): number {
  // Lotes de 8,66 m en Rosario: las casas ocupan 3 módulos casi siempre.
  if (kind === "casas") return rand() < 0.75 ? 3 : 2;
  return 2 + Math.floor(rand() * 3);
}

/**
 * Parte un frente en lotes. `corner` es la ochava del principio (el primer
 * edificio comparte su altura); `skip` son módulos que quedan libres (la
 * boca de un pasaje).
 */
function buildFront(
  rand: () => number,
  id: string,
  origin: Vec2,
  dir: Vec2,
  normal: Vec2,
  totalModules: number,
  corner: StreetCorner | null,
  kind: BlockKind,
  chunk: string,
  skip: readonly [number, number] | null = null,
): StreetBuilding[] {
  const out: StreetBuilding[] = [];
  let offset = 0;
  let index = 0;
  const tints = kind === "casas" ? HOUSE_TINTS : TINTS;
  while (offset < totalModules) {
    if (skip && offset >= skip[0] && offset < skip[1]) {
      offset = skip[1];
      continue;
    }
    const limit = skip && offset < skip[0] ? skip[0] : totalModules;
    const left = limit - offset;
    let modules = Math.min(left, lotModules(rand, kind));
    if (left - modules === 1) modules += 1;
    const isCorner = index === 0 && corner !== null && offset === 0;
    const startD = offset * STREET.module;
    const endD = (offset + modules) * STREET.module;
    out.push({
      id: `${id}-${index}`,
      start: [origin[0] + dir[0] * startD, origin[1] + dir[1] * startD],
      end: [origin[0] + dir[0] * endD, origin[1] + dir[1] * endD],
      normal,
      modules,
      floors: isCorner && corner ? corner.floors : randomFloors(rand, kind),
      tint: isCorner && corner ? corner.tint : pick(rand, tints),
      upperWindows: isCorner && corner ? corner.upperWindows : pick(rand, UPPER_STYLES),
      ground: groundFor(rand, modules, kind),
      nightLitFraction: 0.15 + rand() * 0.45,
      corner: isCorner,
      chunk,
    });
    offset += modules;
    index += 1;
  }
  return out;
}

/** Línea de edificación de la manzana entre los ejes `a` y `a + pitch` (en cada eje). */
function blockRect(ix: number, iz: number): { x0: number; x1: number; z0: number; z1: number } {
  const ax = CITY.lines[0] + ix * CITY.pitch;
  const az = CITY.lines[0] + iz * CITY.pitch;
  return { x0: ax + BUILDING_LINE, x1: ax + CITY.pitch - BUILDING_LINE, z0: az + BUILDING_LINE, z1: az + CITY.pitch - BUILDING_LINE };
}

function makeBlocks(rand: () => number): CityBlock[] {
  const out: CityBlock[] = [];
  for (let iz = -1; iz <= CITY.blocks; iz += 1) {
    for (let ix = -1; ix <= CITY.blocks; ix += 1) {
      const ring = ix < 0 || iz < 0 || ix >= CITY.blocks || iz >= CITY.blocks;
      // Las del anillo con índice −1 se nombran "a" (antes de la primera).
      const tag = (n: number) => (n < 0 ? "a" : String(n));
      const id = `m${tag(ix)}-${tag(iz)}`;
      const kind: BlockKind = ring ? (rand() < 0.55 ? "centro" : "mixto") : BLOCK_KINDS[iz][ix];
      const r = blockRect(ix, iz);
      const axis = ring ? undefined : ALLEYS[`m${ix}-${iz}`];
      let alley: Alley | null = null;
      if (axis) {
        // Boca de 2 módulos (6 m) a mitad de cuadra.
        const side = r.x1 - r.x0;
        const mid = STREET.chamfer + Math.floor((side - 2 * STREET.chamfer) / STREET.module / 2) * STREET.module;
        const at = (axis === "x" ? r.z0 : r.x0) + mid;
        alley = {
          axis,
          at,
          width: 2 * STREET.module,
          from: axis === "x" ? r.x0 : r.z0,
          to: axis === "x" ? r.x1 : r.z1,
        };
      }
      out.push({ id, kind, ix, iz, ...r, ring, alley });
    }
  }
  return out;
}

/**
 * Edificios y ochavas de una manzana. Recorre los cuatro lados en sentido
 * antihorario, cada uno desde su ochava.
 */
function buildBlock(rand: () => number, block: CityBlock): { buildings: StreetBuilding[]; corners: StreetCorner[] } {
  const buildings: StreetBuilding[] = [];
  const corners: StreetCorner[] = [];
  if (block.kind === "plaza") return { buildings, corners };
  const c = STREET.chamfer;
  const side = block.x1 - block.x0;
  const modules = Math.round((side - 2 * c) / STREET.module);
  const cornerAt = (sx: 1 | -1, sz: 1 | -1, name: string): StreetCorner => {
    // (sx, sz): hacia dónde queda el cruce visto desde la manzana.
    const px = sx > 0 ? block.x1 : block.x0;
    const pz = sz > 0 ? block.z1 : block.z0;
    const corner: StreetCorner = {
      id: `${block.id}-${name}-ochava`,
      onMain: [px, pz - sz * c],
      onCross: [px - sx * c, pz],
      normal: [sx * Math.SQRT1_2, sz * Math.SQRT1_2],
      floors: block.kind === "casas" ? 1 + Math.floor(rand() * 2) : block.kind === "mixto" ? 2 + Math.floor(rand() * 2) : 4 + Math.floor(rand() * 3),
      tint: pick(rand, block.kind === "casas" ? HOUSE_TINTS : TINTS),
      upperWindows: pick(rand, UPPER_STYLES),
      chunk: block.id,
    };
    corners.push(corner);
    return corner;
  };
  const sw = cornerAt(-1, -1, "so");
  const se = cornerAt(1, -1, "se");
  const ne = cornerAt(1, 1, "ne");
  const nw = cornerAt(-1, 1, "no");
  const gap = (axisOfSide: "x" | "z"): readonly [number, number] | null => {
    // El pasaje que corre en X abre los lados que corren en Z, y viceversa.
    if (!block.alley || block.alley.axis === axisOfSide) return null;
    const startCoord = axisOfSide === "z" ? block.z0 + c : block.x0 + c;
    const first = Math.round((block.alley.at - block.alley.width / 2 - startCoord) / STREET.module);
    return [first, first + Math.round(block.alley.width / STREET.module)];
  };
  const flip = (g: readonly [number, number] | null): readonly [number, number] | null => (g ? [modules - g[1], modules - g[0]] : null);
  // Sur (corre en X, mira a −Z), de oeste a este.
  buildings.push(...buildFront(rand, `${block.id}-s`, sw.onCross, [1, 0], [0, -1], modules, sw, block.kind, block.id, gap("x")));
  // Este (corre en Z, mira a +X), de sur a norte.
  buildings.push(...buildFront(rand, `${block.id}-e`, se.onMain, [0, 1], [1, 0], modules, se, block.kind, block.id, gap("z")));
  // Norte, de este a oeste.
  buildings.push(...buildFront(rand, `${block.id}-n`, ne.onCross, [-1, 0], [0, 1], modules, ne, block.kind, block.id, flip(gap("x"))));
  // Oeste, de norte a sur.
  buildings.push(...buildFront(rand, `${block.id}-o`, nw.onMain, [0, -1], [-1, 0], modules, nw, block.kind, block.id, flip(gap("z"))));
  return { buildings, corners };
}

/** Las calles: ejes de la cuadrícula, hasta adentro de la bruma. */
function makeStreets(): StreetLine[] {
  const out: StreetLine[] = [];
  for (const at of CITY.lines) {
    // La calle del oeste, entre las casas, conserva el adoquinado.
    out.push({ id: `z${at}`, axis: "z", at, from: CITY.reach[0] - 20, to: CITY.reach[1] + 20, cobbled: at === CITY.lines[0] });
    out.push({ id: `x${at}`, axis: "x", at, from: CITY.reach[0] - 20, to: CITY.reach[1] + 20, cobbled: false });
  }
  return out;
}

/** La plaza: senderos en diagonal y en cruz, monumento al centro y una fuente. */
function makePlaza(block: CityBlock): Plaza {
  const cx = (block.x0 + block.x1) / 2;
  const cz = (block.z0 + block.z1) / 2;
  const half = (block.x1 - block.x0) / 2;
  const r = 10;
  const paths: Plaza["paths"] = [];
  // Diagonales de esquina al círculo central y senderos en cruz desde la mitad de cada lado.
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    paths.push({ from: [cx + dx * (half - 1), cz + dz * (half - 1)], to: [cx + (dx * r) / Math.SQRT2, cz + (dz * r) / Math.SQRT2], width: 3 });
  }
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    paths.push({ from: [cx + dx * half, cz + dz * half], to: [cx + dx * r, cz + dz * r], width: 2.5 });
  }
  return {
    block,
    center: [cx, cz],
    monumentRadius: r,
    fountain: { center: [cx + 24, cz - 24], radius: 3.2 },
    flagOffset: [5.3, -5.3],
    paths,
  };
}

/** Puntos de un círculo (para recorrerlo caminando), de `a0` a `a1` (rad). */
function arc(center: Vec2, radius: number, a0: number, a1: number, steps: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)]);
  }
  return out;
}

function makeProps(rand: () => number, blocks: CityBlock[], streets: StreetLine[], plaza: Plaza): StreetProp[] {
  const props: StreetProp[] = [];
  const h = STREET.curbHeight;
  const L = BUILDING_LINE;
  for (const b of blocks) {
    if (b.kind === "plaza") continue;
    // Veredas de los cuatro lados: árboles, faroles y algo de mobiliario.
    const sides: { along: "x" | "z"; at: number; sign: 1 | -1; from: number; to: number }[] = [
      { along: "x", at: b.z0 - L, sign: 1, from: b.x0, to: b.x1 },
      { along: "x", at: b.z1 + L, sign: -1, from: b.x0, to: b.x1 },
      { along: "z", at: b.x0 - L, sign: 1, from: b.z0, to: b.z1 },
      { along: "z", at: b.x1 + L, sign: -1, from: b.z0, to: b.z1 },
    ];
    for (const s of sides) {
      // `at` es el eje de la calle; el cordón queda a roadHalf de él, del lado de la manzana.
      const curb = s.at + s.sign * (STREET.roadHalf + 0.55);
      const treeLine = s.at + s.sign * (STREET.roadHalf + 0.9);
      const lampEvery = 25;
      const treeEvery = b.kind === "centro" ? 12 : 9;
      const facing = s.along === "x" ? (s.sign > 0 ? 0 : Math.PI) : s.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
      // La boca del pasaje queda libre (sin árbol ni farol tapándola).
      const mouth = b.alley && b.alley.axis !== s.along ? b.alley.at : null;
      const atMouth = (p: number) => mouth !== null && Math.abs(p - mouth) < b.alley!.width / 2 + 3;
      // El brazo del farol (+X del modelo) apunta hacia el eje de la calle.
      const lampRot = s.along === "z" ? (s.sign > 0 ? Math.PI : 0) : (s.sign * Math.PI) / 2;
      for (let d = 10; d <= s.to - s.from - 10; d += lampEvery) {
        const p = s.from + d;
        if (atMouth(p)) continue;
        props.push({ kind: "lamp", position: s.along === "x" ? [p, h, curb] : [curb, h, p], rotationY: lampRot });
      }
      if (b.ring) continue;
      for (let d = 15; d <= s.to - s.from - 15; d += treeEvery) {
        if ((d - 10) % lampEvery < 3) continue;
        const p = s.from + d + (rand() - 0.5) * 1.5;
        if (atMouth(p)) continue;
        // En el barrio de casas hay árboles más jóvenes (más chicos).
        const scale = b.kind === "casas" ? 0.7 + rand() * 0.25 : 0.9 + rand() * 0.2;
        props.push({ kind: "tree", position: s.along === "x" ? [p, h, treeLine] : [treeLine, h, p], rotationY: rand() * Math.PI * 2, scale });
      }
      // Cestos en las esquinas, alguna boca de incendio y un tablero eléctrico.
      for (const end of [s.from + 2, s.to - 2]) {
        props.push({ kind: "trash", position: s.along === "x" ? [end, h, s.at + s.sign * (STREET.roadHalf + 0.6)] : [s.at + s.sign * (STREET.roadHalf + 0.6), h, end], rotationY: facing });
      }
      if (rand() < 0.6) {
        const p = s.from + 20 + rand() * (s.to - s.from - 40);
        props.push({ kind: "hydrant", position: s.along === "x" ? [p, h, s.at + s.sign * (STREET.roadHalf + 0.5)] : [s.at + s.sign * (STREET.roadHalf + 0.5), h, p], rotationY: facing });
      }
      const wall = s.at + s.sign * (L - 0.4);
      if (rand() < 0.5) {
        const p = s.from + 15 + rand() * (s.to - s.from - 30);
        props.push({ kind: "utility", position: s.along === "x" ? [p, h, wall] : [wall, h, p], rotationY: facing });
      }
      // Centro: mesas de café en la vereda. Casas: sillas de plástico en la puerta y macetas.
      if (b.kind === "centro" && rand() < 0.55) {
        const p = s.from + 12 + rand() * (s.to - s.from - 24);
        for (let k = 0; k < 2; k += 1) {
          const q = p + k * 3.2;
          props.push({ kind: "cafe-table", position: s.along === "x" ? [q, h, s.at + s.sign * (L - 1.3)] : [s.at + s.sign * (L - 1.3), h, q], rotationY: rand() * Math.PI });
        }
      }
      if (b.kind !== "centro") {
        for (let k = 0; k < 2; k += 1) {
          if (rand() < 0.5) continue;
          const p = s.from + 8 + rand() * (s.to - s.from - 16);
          props.push({ kind: rand() < 0.5 ? "monobloc" : "planter", position: s.along === "x" ? [p, h, s.at + s.sign * (L - 0.6)] : [s.at + s.sign * (L - 0.6), h, p], rotationY: facing + (rand() - 0.5) });
        }
      }
      if (rand() < 0.35) {
        const p = s.from + 10 + rand() * (s.to - s.from - 20);
        props.push({ kind: "bench", position: s.along === "x" ? [p, h, s.at + s.sign * (L - 0.6)] : [s.at + s.sign * (L - 0.6), h, p], rotationY: facing + Math.PI / 2 });
      }
    }
  }

  // Autos estacionados contra el cordón izquierdo de cada calle (mano única).
  for (const st of streets) {
    const side = parkingSide(st);
    for (let k = 0; k < CITY.lines.length - 1 + 2; k += 1) {
      const segFrom = CITY.lines[0] + (k - 1) * CITY.pitch + BUILDING_LINE + 6;
      const segTo = segFrom + CITY.pitch - 2 * BUILDING_LINE - 12;
      if (segTo < CITY.reach[0] || segFrom > CITY.reach[1]) continue;
      let p = Math.max(segFrom, CITY.reach[0] + 4) + rand() * 8;
      const end = Math.min(segTo, CITY.reach[1] - 4);
      // Estacionados en el sentido de la calle.
      const heading = laneHeading(st);
      while (p < end) {
        if (rand() < 0.22) {
          const lateral = st.at + side * (STREET.roadHalf - 1.15);
          const kind: PropKind = rand() < 0.15 ? "covered-car" : "car";
          props.push({ kind, position: st.axis === "z" ? [lateral, 0, p] : [p, 0, lateral], rotationY: heading });
        }
        p += 6.5 + rand() * 6;
      }
    }
  }

  // Tapas en la calzada, cada tanto.
  for (const st of streets) {
    for (let p = CITY.reach[0] + 10; p < CITY.reach[1] - 10; p += 33 + rand() * 20) {
      const lateral = st.at + (rand() - 0.5) * 3;
      if (nearIntersection(p)) continue;
      props.push({ kind: "manhole", position: st.axis === "z" ? [lateral, 0.005, p] : [p, 0.005, lateral], rotationY: 0 });
    }
  }

  props.push(...plazaProps(rand, plaza));
  for (const b of blocks) if (b.alley) props.push(...alleyProps(rand, b, b.alley));
  return props;
}

/** Lado del estacionamiento (−1 o +1 respecto del eje): a la izquierda del sentido de circulación. */
export function parkingSide(st: { axis: "x" | "z"; at: number }): 1 | -1 {
  const dir = laneDirection(st);
  // Avanzando en +Z la izquierda es −X; avanzando en +X la izquierda es +Z.
  return (st.axis === "z" ? -dir : dir) as 1 | -1;
}

/** Sentido de mano única de cada calle: se alternan, como en Rosario. */
export function laneDirection(st: { axis: "x" | "z"; at: number }): 1 | -1 {
  const i = CITY.lines.indexOf(st.at);
  const even = i % 2 === 0;
  return (st.axis === "z" ? (even ? -1 : 1) : even ? 1 : -1) as 1 | -1;
}

/** rotation.y de un auto que circula por la calle (modelo con el frente en +Z). */
export function laneHeading(st: { axis: "x" | "z"; at: number }): number {
  const dir = laneDirection(st);
  return st.axis === "z" ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
}

/**
 * Carriles de una calle (desplazamiento lateral desde el eje). Del lado
 * izquierdo van los estacionados; la calle del centro tiene dos carriles.
 */
export function laneOffsets(st: { axis: "x" | "z"; at: number }): number[] {
  const side = parkingSide(st);
  return st.at === 0 ? [-side * 2.25, side * 0.55] : [-side * 1.3];
}

function nearIntersection(coord: number): boolean {
  return CITY.lines.some((l) => Math.abs(coord - l) < BUILDING_LINE + 4);
}

function plazaProps(rand: () => number, plaza: Plaza): StreetProp[] {
  const out: StreetProp[] = [];
  const h = STREET.curbHeight;
  const [cx, cz] = plaza.center;
  const b = plaza.block;
  // El Libertador a caballo sobre el pedestal alto (StreetPlaza): la cornisa termina a 5,32 m.
  out.push({ kind: "statue", position: [cx, h + 5.32, cz], rotationY: -Math.PI / 4 });
  // Faroles y bancos a lo largo de los senderos.
  for (const p of plaza.paths) {
    const dx = p.to[0] - p.from[0];
    const dz = p.to[1] - p.from[1];
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const heading = Math.atan2(ux, uz);
    for (let d = 8; d < len - 4; d += 14) {
      const side = (Math.floor(d / 14) % 2 === 0 ? 1 : -1) * (p.width / 2 + 0.9);
      const x = p.from[0] + ux * d + uz * side;
      const z = p.from[1] + uz * d - ux * side;
      out.push({ kind: "plaza-lamp", position: [x, h, z], rotationY: heading });
      const bx = p.from[0] + ux * (d + 6) - uz * side;
      const bz = p.from[1] + uz * (d + 6) + ux * side;
      // El banco mira al sendero; los dos modelos de hierro y madera se van alternando.
      const bench: PropKind = Math.floor(d / 14) % 3 === 1 ? "plaza-bench-forjado" : "plaza-bench";
      out.push({ kind: bench, position: [bx, h, bz], rotationY: heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2) });
    }
  }
  // Bancos alrededor del monumento.
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const r = plaza.monumentRadius + 1.2;
    out.push({ kind: "plaza-bench", position: [cx + r * Math.cos(a), h, cz + r * Math.sin(a)], rotationY: Math.PI / 2 - a + Math.PI });
  }
  // Árboles en el césped, lejos de senderos, del monumento y de la fuente.
  const margin = 4;
  for (let gx = b.x0 + 6; gx <= b.x1 - 6; gx += 9) {
    for (let gz = b.z0 + 6; gz <= b.z1 - 6; gz += 9) {
      const x = gx + (rand() - 0.5) * 5;
      const z = gz + (rand() - 0.5) * 5;
      if (!onLawn(plaza, x, z, margin)) continue;
      if (rand() < 0.15) continue;
      const r = rand();
      const kind: PropKind = r < 0.8 ? "tree" : "shrub";
      out.push({ kind, position: [x, h, z], rotationY: rand() * Math.PI * 2, scale: kind === "tree" ? 0.65 + rand() * 0.55 : 1 });
    }
  }
  // Canteros con arbustos alrededor del monumento y en el borde.
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * Math.PI * 2;
    const r = plaza.monumentRadius + 3.5;
    const x = cx + r * Math.cos(a);
    const z = cz + r * Math.sin(a);
    if (onLawn(plaza, x, z, 1.2)) out.push({ kind: "shrub", position: [x, h, z], rotationY: rand() * 6, scale: 0.8 });
  }
  // Carrito de café en una entrada.
  out.push({ kind: "coffee-cart", position: [b.x0 + 9, h, (b.z0 + b.z1) / 2 + 4], rotationY: Math.PI / 2 });
  return out;
}

/** ¿El punto cae en el césped de la plaza (no en senderos, monumento ni fuente)? */
export function onLawn(plaza: Plaza, x: number, z: number, margin = 0): boolean {
  const b = plaza.block;
  if (x < b.x0 + margin || x > b.x1 - margin || z < b.z0 + margin || z > b.z1 - margin) return false;
  if (Math.hypot(x - plaza.center[0], z - plaza.center[1]) < plaza.monumentRadius + margin) return false;
  if (Math.hypot(x - plaza.fountain.center[0], z - plaza.fountain.center[1]) < plaza.fountain.radius + 2 + margin) return false;
  for (const p of plaza.paths) {
    if (distanceToSegment(x, z, p.from, p.to) < p.width / 2 + margin) return false;
  }
  return true;
}

export function distanceToSegment(x: number, z: number, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2)) : 0;
  return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
}

/** Paredes y cosas del pasaje: cables cruzados, faroles de pared, cajones, bolsas, persianas. */
function alleyProps(rand: () => number, block: CityBlock, alley: Alley): StreetProp[] {
  const out: StreetProp[] = [];
  const h = STREET.curbHeight;
  const half = alley.width / 2;
  const along = (d: number, lateral: number): readonly [number, number, number] =>
    alley.axis === "x" ? [alley.from + d, h, alley.at + lateral] : [alley.at + lateral, h, alley.from + d];
  const len = alley.to - alley.from;
  const faceIn = (side: 1 | -1) => (alley.axis === "x" ? (side > 0 ? Math.PI : 0) : side > 0 ? -Math.PI / 2 : Math.PI / 2);
  for (let d = 6; d < len - 4; d += 9 + rand() * 6) {
    const side: 1 | -1 = rand() < 0.5 ? 1 : -1;
    const r = rand();
    const kind: PropKind = r < 0.25 ? "crate" : r < 0.5 ? "trashbag" : r < 0.65 ? "cardboard" : r < 0.8 ? "barrel" : "planter";
    out.push({ kind, position: along(d, side * (half - 0.5)), rotationY: rand() * Math.PI * 2 });
  }
  for (let d = 10; d < len - 6; d += 16) {
    const side: 1 | -1 = Math.floor(d / 16) % 2 === 0 ? 1 : -1;
    const [x, , z] = along(d, side * (half - 0.05));
    out.push({ kind: "wall-lamp", position: [x, 3.4, z], rotationY: faceIn(side) });
    out.push({ kind: "shutter-door", position: along(d + 5, side * (half - 0.02)), rotationY: faceIn(side) });
  }
  // Cables de un lado al otro, colgando.
  for (let d = 8; d < len - 4; d += 11) {
    const [x, , z] = along(d, 0);
    out.push({ kind: "cables", position: [x, 5.5 + rand() * 1.2, z], rotationY: alley.axis === "x" ? Math.PI / 2 : 0 });
  }
  if (block.kind !== "plaza") out.push({ kind: "rat", position: along(len * 0.37, half - 0.3), rotationY: rand() * 6 });
  return out;
}

/** Paredes del pasaje: medianeras de alturas distintas a los dos lados. */
function alleyWalls(rand: () => number, block: CityBlock, alley: Alley): PlainWall[] {
  const out: PlainWall[] = [];
  const half = alley.width / 2;
  // Se descuenta lo que ocupan los edificios del frente (12 m de fondo).
  const depth = 12.3;
  const from = alley.from + depth;
  const to = alley.to - depth;
  for (const side of [1, -1] as const) {
    let d = from;
    while (d < to - 0.1) {
      const len = Math.min(to - d, 8 + rand() * 14);
      const lateral = alley.at + side * half;
      const start: Vec2 = alley.axis === "x" ? [d, lateral] : [lateral, d];
      const end: Vec2 = alley.axis === "x" ? [d + len, lateral] : [lateral, d + len];
      const normal: Vec2 = alley.axis === "x" ? [0, -side] : [-side, 0];
      out.push({ start, end, height: 4 + Math.floor(rand() * 4) * 1.5, thickness: 0.4, normal, tint: pick(rand, [...TINTS, ...HOUSE_TINTS]), chunk: block.id });
      d += len;
    }
  }
  return out;
}

function makeNeonBar(blocks: CityBlock[]): NeonBar | null {
  const alley = blocks.find((b) => b.id === NEON_BAR_BLOCK)?.alley;
  if (!alley) return null;
  const d = alley.from + (alley.to - alley.from) * 0.45;
  const lateral = alley.at - alley.width / 2;
  return alley.axis === "x"
    ? { center: [d, lateral], normal: [0, 1], along: [1, 0], width: NEON_BAR_WIDTH }
    : { center: [lateral, d], normal: [1, 0], along: [0, 1], width: NEON_BAR_WIDTH };
}

/** Despeja el frente del bar (cajones, persianas, faroles) y le pone dos mesas afuera. */
function withNeonBar(props: StreetProp[], bar: NeonBar | null): StreetProp[] {
  if (!bar) return props;
  const [cx, cz] = bar.center;
  const [ax, az] = bar.along;
  const [nx, nz] = bar.normal;
  const local = (p: readonly number[]) => ({ along: (p[0] - cx) * ax + (p[2] - cz) * az, out: (p[0] - cx) * nx + (p[2] - cz) * nz });
  const kept = props.filter((p) => {
    const l = local(p.position);
    return !(Math.abs(l.along) < bar.width / 2 + 1.5 && l.out < 2.5 && p.kind !== "cables");
  });
  const h = STREET.curbHeight;
  const facing = Math.atan2(nx, nz);
  for (const along of [-1.9, 1.9]) {
    kept.push({ kind: "cafe-table", position: [cx + ax * along + nx * 1.5, h, cz + az * along + nz * 1.5], rotationY: facing + along * 0.2 });
  }
  return kept;
}

/** Grafitis en el pasaje y en persianas, afiches cerca de las esquinas. */
function makeWallDecals(rand: () => number, blocks: CityBlock[], walls: PlainWall[], buildings: StreetBuilding[]): WallDecal[] {
  const out: WallDecal[] = [];
  for (const w of walls) {
    const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1]);
    if (len < 5 || rand() < 0.25) continue;
    const t = 0.2 + rand() * 0.6;
    const x = w.start[0] + (w.end[0] - w.start[0]) * t + w.normal[0] * 0.02;
    const z = w.start[1] + (w.end[1] - w.start[1]) * t + w.normal[1] * 0.02;
    const width = Math.min(len - 1, 3 + rand() * 3);
    out.push({ kind: "graffiti", position: [x, STREET.curbHeight + 0.4 + width * 0.22, z], size: [width, width * 0.45], rotationY: Math.atan2(w.normal[0], w.normal[1]), variant: Math.floor(rand() * 6) });
  }
  for (const b of buildings) {
    if (b.corner || rand() > 0.12) continue;
    const t = 0.5;
    const x = b.start[0] + (b.end[0] - b.start[0]) * t + b.normal[0] * 0.18;
    const z = b.start[1] + (b.end[1] - b.start[1]) * t + b.normal[1] * 0.18;
    const kind: WallDecalKind = b.ground.includes("shutter") && rand() < 0.6 ? "graffiti" : "poster";
    out.push({
      kind,
      position: [x, kind === "poster" ? 1.6 : 1.3, z],
      size: kind === "poster" ? [0.7, 1] : [2.2, 1],
      rotationY: Math.atan2(b.normal[0], b.normal[1]),
      variant: Math.floor(rand() * 6),
    });
  }
  void blocks;
  return out;
}

/** Charcos, hojas, flores de jacarandá, parches, manchas de aceite, rayuela y rejillas. */
function makeGroundDecals(rand: () => number, streets: StreetLine[], props: StreetProp[], plaza: Plaza, blocks: CityBlock[]): GroundDecal[] {
  const out: GroundDecal[] = [];
  const h = STREET.curbHeight + 0.006;
  for (const st of streets) {
    for (let p = CITY.reach[0]; p < CITY.reach[1]; p += 7 + rand() * 18) {
      const r = rand();
      const lateral = st.at + (rand() < 0.5 ? 1 : -1) * (STREET.roadHalf - 0.5 - rand() * 0.6);
      const place = (kind: GroundDecalKind, size: Vec2, lat = lateral): GroundDecal => ({
        kind,
        position: st.axis === "z" ? [lat, 0.006, p] : [p, 0.006, lat],
        size,
        rotationY: rand() * Math.PI * 2,
        variant: Math.floor(rand() * 4),
      });
      // Charcos junto al cordón (la calle tiene pendiente hacia la cuneta).
      if (r < 0.28) out.push(place("puddle", [1.2 + rand() * 2.5, 0.8 + rand() * 1.4]));
      else if (r < 0.48) out.push(place("patch", [1.5 + rand() * 2.5, 1 + rand() * 2], st.at + (rand() - 0.5) * 5));
      else if (r < 0.58) out.push(place("oil", [0.6 + rand() * 0.8, 0.5 + rand() * 0.6], st.at + (rand() - 0.5) * 4));
    }
    // Rejillas de desagüe antes de cada esquina y flechas de sentido de circulación.
    for (const line of CITY.lines) {
      for (const s of [-1, 1] as const) {
        const p = line + s * (BUILDING_LINE + 1);
        const lat = st.at + (rand() < 0.5 ? 1 : -1) * (STREET.roadHalf - 0.3);
        out.push({ kind: "drain", position: st.axis === "z" ? [lat, 0.007, p] : [p, 0.007, lat], size: [0.9, 0.45], rotationY: st.axis === "z" ? 0 : Math.PI / 2, variant: 0 });
      }
      const dir = laneDirection(st);
      const p = line - dir * (BUILDING_LINE + 9);
      const lane = st.at + laneOffsets(st)[0];
      out.push({ kind: "arrow", position: st.axis === "z" ? [lane, 0.007, p] : [p, 0.007, lane], size: [1, 3], rotationY: laneHeading(st), variant: 0 });
    }
  }
  // Hojas y flores caídas bajo los árboles.
  for (const pr of props) {
    if (pr.kind !== "tree") continue;
    if (rand() < 0.4) continue;
    const jacaranda = rand() < 0.6;
    out.push({
      kind: jacaranda ? "petals" : "leaves",
      position: [pr.position[0] + (rand() - 0.5) * 2, h, pr.position[2] + (rand() - 0.5) * 2],
      size: [2.5 + rand() * 3, 2 + rand() * 3],
      rotationY: rand() * Math.PI * 2,
      variant: Math.floor(rand() * 4),
    });
  }
  // Una rayuela pintada con tiza en un sendero de la plaza y algún charco en el pasaje.
  const path = plaza.paths[4];
  const mx = (path.from[0] + path.to[0]) / 2;
  const mz = (path.from[1] + path.to[1]) / 2;
  out.push({ kind: "chalk", position: [mx, h, mz], size: [1.1, 3.4], rotationY: Math.atan2(path.to[0] - path.from[0], path.to[1] - path.from[1]), variant: 0 });
  for (const b of blocks) {
    if (!b.alley) continue;
    const a = b.alley;
    for (let k = 0; k < 4; k += 1) {
      const d = a.from + 14 + rand() * (a.to - a.from - 28);
      const lat = a.at + (rand() - 0.5) * (a.width - 1.5);
      out.push({ kind: "puddle", position: a.axis === "x" ? [d, h, lat] : [lat, h, d], size: [1 + rand() * 1.5, 0.8 + rand()], rotationY: rand() * 6, variant: Math.floor(rand() * 4) });
    }
  }
  // Esténcil de un ojo en una esquina del centro (los fotógrafos lo buscan).
  out.push({ kind: "stencil", position: [BUILDING_LINE - 1.2, h, -BUILDING_LINE - 6], size: [1.2, 1.2], rotationY: 0.4, variant: 0 });
  return out;
}

function makeColliders(blocks: CityBlock[], plaza: Plaza): CollisionRect[] {
  const out: CollisionRect[] = [];
  for (const b of blocks) {
    if (b.kind === "plaza") continue;
    if (!b.alley) {
      out.push({ xMin: b.x0, xMax: b.x1, zMin: b.z0, zMax: b.z1 });
      continue;
    }
    const a = b.alley;
    const lo = a.at - a.width / 2;
    const hi = a.at + a.width / 2;
    if (a.axis === "x") {
      out.push({ xMin: b.x0, xMax: b.x1, zMin: b.z0, zMax: lo }, { xMin: b.x0, xMax: b.x1, zMin: hi, zMax: b.z1 });
    } else {
      out.push({ xMin: b.x0, xMax: lo, zMin: b.z0, zMax: b.z1 }, { xMin: hi, xMax: b.x1, zMin: b.z0, zMax: b.z1 });
    }
  }
  // Pedestal del monumento y fuente.
  const [cx, cz] = plaza.center;
  out.push({ xMin: cx - 3, xMax: cx + 3, zMin: cz - 3, zMax: cz + 3 });
  const f = plaza.fountain;
  const fr = f.radius * 0.85;
  out.push({ xMin: f.center[0] - fr, xMax: f.center[0] + fr, zMin: f.center[1] - fr, zMax: f.center[1] + fr });
  // Borde del mundo: más allá del alcance de las calles no se sigue.
  const [lo, hi] = CITY.reach;
  const big = 400;
  out.push(
    { xMin: lo - big, xMax: lo, zMin: lo - big, zMax: hi + big },
    { xMin: hi, xMax: hi + big, zMin: lo - big, zMax: hi + big },
    { xMin: lo, xMax: hi, zMin: lo - big, zMax: lo },
    { xMin: lo, xMax: hi, zMin: hi, zMax: hi + big },
  );
  return out;
}

/**
 * Recorridos cerrados por las veredas: vueltas a una manzana, a dos manzanas
 * (cruzando por la senda) y por la plaza. Nadie da media vuelta ni desaparece.
 */
function makeWalkPaths(blocks: CityBlock[], plaza: Plaza): WalkPath[] {
  const band = STREET.roadHalf + STREET.sidewalk / 2;
  const out: WalkPath[] = [];
  const loop = (x0: number, x1: number, z0: number, z1: number): Vec2[] => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  const inner = blocks.filter((b) => !b.ring);
  for (const b of inner) {
    const ax = b.x0 - BUILDING_LINE;
    const az = b.z0 - BUILDING_LINE;
    const p = CITY.pitch;
    // Alrededor de la manzana, por la vereda (sentido antihorario).
    out.push({ id: `vuelta-${b.id}`, points: loop(ax + band, ax + p - band, az + band, az + p - band), speed: 1.25 + ((b.ix + b.iz) % 3) * 0.08 });
  }
  // Recorridos largos, para poder seguir a alguien un buen rato: la vuelta a todo el barrio
  // (unos 1,2 km por las veredas de afuera) y la de cuatro manzanas (unos 800 m).
  const [l0, l1, , l3] = CITY.lines;
  out.push({ id: "vuelta-al-barrio", points: loop(l0 + band, l3 - band, l0 + band, l3 - band), speed: 1.3 });
  out.push({ id: "vuelta-al-barrio-contramano", points: loop(l0 + band, l3 - band, l0 + band, l3 - band).reverse(), speed: 1.38 });
  out.push({ id: "vuelta-cuatro-manzanas", points: loop(l0 + band, CITY.lines[2] - band, l1 + band, l3 - band), speed: 1.25 });
  // Vueltas largas de dos manzanas: cruzan la calle del medio por la senda.
  out.push({ id: "vuelta-larga-sur", points: loop(CITY.lines[0] + band, CITY.lines[2] - band, CITY.lines[0] + band, CITY.lines[1] - band).reverse(), speed: 1.4 });
  out.push({ id: "vuelta-larga-este", points: loop(CITY.lines[2] + band, CITY.lines[3] - band, CITY.lines[0] + band, CITY.lines[2] - band), speed: 1.35 });
  // Por la plaza: de una esquina al monumento, media vuelta al círculo y a la esquina opuesta.
  // Las diagonales entran a 45°: se sale y se vuelve por la vereda sin doblar más de 90°.
  const [cx, cz] = plaza.center;
  const half = (plaza.block.x1 - plaza.block.x0) / 2 - 1;
  const edge = (plaza.block.x1 - plaza.block.x0) / 2 + BUILDING_LINE - band;
  const r = plaza.monumentRadius + 0.8;
  out.push({
    id: "plaza-diagonal",
    points: [
      [cx - half, cz - half],
      ...arc(plaza.center, r, (-3 * Math.PI) / 4, Math.PI / 4, 8),
      [cx + half, cz + half],
      [cx + edge, cz + half],
      [cx + edge, cz - edge],
      [cx - half, cz - edge],
    ],
    speed: 1.15,
  });
  out.push({
    id: "plaza-cruz",
    points: [
      [cx, cz - edge],
      ...arc(plaza.center, r, -Math.PI / 2, -Math.PI * 1.5, 10),
      [cx, cz + edge],
      [cx - edge, cz + edge],
      [cx - edge, cz - edge],
    ],
    speed: 1.1,
  });
  for (const b of inner) {
    if (!b.alley) continue;
    // Atraviesa el pasaje y vuelve por la vereda.
    const a = b.alley;
    const ax = b.x0 - BUILDING_LINE;
    const az = b.z0 - BUILDING_LINE;
    if (a.axis === "x") {
      out.push({ id: `pasaje-${b.id}`, points: [[ax + band, a.at], [ax + CITY.pitch - band, a.at], [ax + CITY.pitch - band, az + band], [ax + band, az + band]], speed: 1.2 });
    } else {
      out.push({ id: `pasaje-${b.id}`, points: [[a.at, az + band], [a.at, az + CITY.pitch - band], [ax + band, az + CITY.pitch - band], [ax + band, az + band]], speed: 1.2 });
    }
  }
  return out;
}

export function buildStreetLayout(seed = 2026): StreetLayout {
  const rand = seededRandom(seed);
  const blocks = makeBlocks(rand);
  const buildings: StreetBuilding[] = [];
  const corners: StreetCorner[] = [];
  const walls: PlainWall[] = [];
  for (const b of blocks) {
    const made = buildBlock(rand, b);
    buildings.push(...made.buildings);
    corners.push(...made.corners);
    if (b.alley) walls.push(...alleyWalls(rand, b, b.alley));
  }
  const streets = makeStreets();
  const plaza = makePlaza(blocks.find((b) => b.kind === "plaza")!);
  const neonBar = makeNeonBar(blocks);
  const props = withNeonBar(makeProps(rand, blocks, streets, plaza), neonBar);
  const groundDecals = makeGroundDecals(rand, streets, props, plaza, blocks);
  const wallDecals = makeWallDecals(rand, blocks, walls, buildings);
  return {
    blocks,
    streets,
    buildings,
    corners,
    walls,
    props,
    groundDecals,
    wallDecals,
    plaza,
    neonBar,
    colliders: makeColliders(blocks, plaza),
    walkPaths: makeWalkPaths(blocks, plaza),
    bounds: { xMin: CITY.reach[0] + 1, xMax: CITY.reach[1] - 1, zMin: CITY.reach[0] + 1, zMax: CITY.reach[1] - 1 },
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

/** ¿El punto está sobre una calzada? */
export function onRoad(x: number, z: number): boolean {
  return CITY.lines.some((l) => Math.abs(x - l) < STREET.roadHalf || Math.abs(z - l) < STREET.roadHalf);
}

/** Altura del piso: veredas, plaza y pasajes están 15 cm sobre la calzada. */
export function streetGroundHeight(x: number, z: number): number {
  return onRoad(x, z) ? 0 : STREET.curbHeight;
}
