/**
 * Plan de piezas de fachada: qué pieza del kit modular va en cada lugar.
 *
 * El kit (Poly Haven `modular_urban_apartments_facade`, CC0) trae paredes de
 * 3 × 3 m con el origen en su borde derecho y la cara hacia +Z local, más
 * ventanas, puertas, zócalos, cornisas y remates que comparten ese origen.
 * Este módulo sólo calcula transformaciones (sin three.js) para poder probarlo.
 */

import {
  STREET,
  type GroundStyle,
  type StreetBuilding,
  type StreetCorner,
  type UpperWindowStyle,
  type Vec2,
} from "./street-layout";

export interface PiecePlacement {
  /** Nombre del nodo del kit. */
  piece: string;
  /** Posición en el mundo. */
  position: readonly [number, number, number];
  /** Rotación alrededor de Y (rad). */
  rotationY: number;
  /** Color de revoque (sólo paredes) o null para dejar el material original. */
  tint: string | null;
  /** Ventana o vidriera con luz encendida de noche. */
  lit?: boolean;
}

/** Marco local de un frente: origen, dirección a lo largo y ángulo en Y. */
export interface FrontFrame {
  origin: Vec2;
  dir: Vec2;
  rotationY: number;
  length: number;
}

const GROUND_PIECES: Record<GroundStyle, { wall: string; fill: string; dado: string }> = {
  shop: { wall: "wall_door_centered_large_01", fill: "door_centered_large_01", dado: "dado_door_centered_large_01" },
  residential: { wall: "wall_door_centered_small_01", fill: "door_centered_small_01", dado: "dado_door_centered_small_01" },
  shutter: { wall: "wall_door_window_small_01", fill: "door_window_small_01", dado: "dado_door_window_small_01" },
};

/**
 * Orienta el frente para que la cara del kit (+Z local) mire hacia la calle:
 * la normal debe ser dirección × arriba; si no, se recorre al revés.
 */
export function frontFrame(start: Vec2, end: Vec2, normal: Vec2): FrontFrame {
  let a = start;
  let b = end;
  let dx = b[0] - a[0];
  let dz = b[1] - a[1];
  // dir × up (en x,z) = (-dz, dx)
  if (-dz * normal[0] + dx * normal[1] < 0) {
    [a, b] = [b, a];
    dx = -dx;
    dz = -dz;
  }
  const length = Math.hypot(dx, dz);
  const dir: Vec2 = [dx / length, dz / length];
  // Rotación en Y que lleva +X local a `dir`: x' = cos·x + sin·z, z' = −sin·x + cos·z.
  const rotationY = Math.atan2(-dir[1], dir[0]);
  return { origin: a, dir, rotationY, length };
}

function at(frame: FrontFrame, along: number, y: number): readonly [number, number, number] {
  return [frame.origin[0] + frame.dir[0] * along, y, frame.origin[1] + frame.dir[1] * along];
}

/** Piezas de un edificio entre medianeras. */
export function planBuilding(building: StreetBuilding): PiecePlacement[] {
  const frame = frontFrame(building.start, building.end, building.normal);
  const out: PiecePlacement[] = [];
  const push = (piece: string, along: number, y: number, tint: string | null = null, lit = false) =>
    out.push({ piece, position: at(frame, along, y), rotationY: frame.rotationY, tint, lit });

  const h = STREET.floorHeight;
  const lights = litWindows(building);
  for (let m = 0; m < building.modules; m += 1) {
    // El origen de cada pieza está en su borde derecho.
    const along = (m + 1) * STREET.module;
    // Si el frente se recorrió al revés, los locales quedan en el mismo orden visual.
    const ground = GROUND_PIECES[building.ground[m] ?? "shop"];
    push(ground.wall, along, 0, building.tint);
    push(ground.fill, along, 0, null, lights[0]?.[m] ?? false);
    push(ground.dado, along, 0);
    for (let f = 1; f < building.floors; f += 1) {
      push(`wall_window_${building.upperWindows}`, along, f * h, building.tint);
      push(`window_${building.upperWindows}`, along, f * h, null, lights[f]?.[m] ?? false);
    }
    push("cornice_standard_standard_01", along, h - 0.1);
    push("crown_standard_standard_01", along, building.floors * h);
  }
  // Pilares en las medianeras: tapan la unión con el vecino.
  for (const along of [0, frame.length]) {
    for (let f = 0; f < building.floors; f += 1) push("wall_pier_standard_01", along, f * h, building.tint);
    push("dado_pier_pedestal_01", along, 0);
    push("crown_pier_pedestal_01", along, building.floors * h);
  }
  return out;
}

/**
 * Ochava: la pieza en diagonal del kit ocupa el cuadrado (−3…0, −3…0) local
 * y su cara mira hacia (+1, +1). Se apoya con origen en la esquina de las
 * líneas de edificación y se gira para mirar a la esquina.
 */
export function planCorner(corner: StreetCorner): PiecePlacement[] {
  const sx = Math.sign(corner.onMain[0]);
  const sz = Math.sign(corner.onCross[1]);
  const rotationY = sx > 0 && sz > 0 ? Math.PI : sx > 0 ? -Math.PI / 2 : sz > 0 ? Math.PI / 2 : 0;
  const ox = corner.onMain[0];
  const oz = corner.onCross[1];
  const out: PiecePlacement[] = [];
  const push = (piece: string, y: number, tint: string | null = null) =>
    out.push({ piece, position: [ox, y, oz], rotationY, tint });
  const h = STREET.floorHeight;
  push("wall_door_angled_large_01", 0, corner.tint);
  push("door_angled_large_01", 0);
  push("dado_door_angled_large_01", 0);
  for (let f = 1; f < corner.floors; f += 1) {
    push("wall_window_angled_large_01", f * h, corner.tint);
    push(`window_angled_large_${corner.upperWindows === "centered_large_01" ? "01" : "02"}`, f * h);
  }
  push("cornice_standard_angled_large_01", h - 0.1);
  push("crown_standard_angled_large_01", corner.floors * h);
  return out;
}

/** Ventanas de un edificio (columna, piso) que tienen luz de noche. */
export function litWindows(building: { id: string; modules: number; floors: number; nightLitFraction: number }): boolean[][] {
  let h = 2166136261;
  for (const ch of building.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return Array.from({ length: building.floors }, (_, floor) =>
    Array.from({ length: building.modules }, () => (floor === 0 ? rand() < 0.7 : rand() < building.nightLitFraction)),
  );
}

export type { UpperWindowStyle };
