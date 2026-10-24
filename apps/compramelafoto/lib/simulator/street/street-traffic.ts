/**
 * Tránsito de la Calle 3D.
 *
 * Calles de mano única que alternan el sentido, como en Rosario. Las que
 * corren a lo largo de Z tienen prioridad; las que corren a lo largo de X
 * tienen PARE en cada esquina. Cada auto maneja con el modelo de conductor
 * inteligente (IDM): mantiene distancia con el de adelante, frena ante
 * peatones en su carril, respeta el PARE y no entra a una esquina ocupada.
 * Los autos entran y salen lejos, dentro de la bruma, así nunca aparecen de golpe.
 */

import { STREET_CARS, streetCarFor } from "./street-cars";
import { BUILDING_LINE, CITY, STREET, laneDirection, laneOffsets, seededRandom, type Vec2 } from "./street-layout";

export interface Lane {
  id: string;
  /** Eje por el que se avanza. */
  axis: "x" | "z";
  /** Sentido sobre ese eje. */
  dir: 1 | -1;
  /** Coordenada lateral del centro del carril. */
  offset: number;
  /** Eje de la calle a la que pertenece. */
  street: number;
  /** Coordenada de entrada y de salida sobre el eje. */
  from: number;
  to: number;
  /** Tiene PARE en cada esquina (las que corren en X). */
  yields: boolean;
}

/** Entradas y salidas: dentro de la bruma, pasando el anillo de manzanas. */
const EDGE_LO = CITY.reach[0] - 25;
const EDGE_HI = CITY.reach[1] + 25;

function buildLanes(): Lane[] {
  const out: Lane[] = [];
  for (const axis of ["z", "x"] as const) {
    for (const at of CITY.lines) {
      const st = { axis, at };
      const dir = laneDirection(st);
      laneOffsets(st).forEach((off, k) => {
        out.push({
          id: `${axis}${at}-${k}`,
          axis,
          dir,
          offset: at + off,
          street: at,
          from: dir > 0 ? EDGE_LO : EDGE_HI,
          to: dir > 0 ? EDGE_HI : EDGE_LO,
          yields: axis === "x",
        });
      });
    }
  }
  return out;
}

export const LANES: readonly Lane[] = buildLanes();

export interface TrafficCar {
  id: string;
  lane: number;
  /** Metros recorridos desde la entrada del carril. */
  s: number;
  /** Velocidad actual (m/s). */
  v: number;
  /** Velocidad deseada (m/s). */
  v0: number;
  length: number;
  /** Segundos detenido en el PARE. */
  stoppedFor: number;
  /** Esquina (coordenada del eje transversal) cuyo PARE ya respetó. */
  clearedAt: number | null;
  /** Fuera de la calle, esperando hueco para entrar. */
  parked: boolean;
  /** Modelo de auto (índice en STREET_CARS). */
  model: number;
}

const IDM = {
  /** Aceleración máxima (m/s²). */
  a: 1.6,
  /** Frenado cómodo (m/s²). */
  b: 3,
  /** Distancia mínima detenido (m). */
  s0: 2.2,
  /** Tiempo de separación (s). */
  T: 1.3,
};

/** Línea de PARE: antes de la senda (que va entre el cordón y la línea de edificación). */
const STOP_OFFSET = BUILDING_LINE + 0.5;
/** Media caja de una esquina (donde se cruzan las calzadas). */
const BOX = STREET.roadHalf + 0.5;

export function laneLength(lane: Lane): number {
  return Math.abs(lane.to - lane.from);
}

/** Posición en el mundo y rumbo (rotation.y para un modelo que mira a +Z). */
export function carPose(lane: Lane, s: number): { x: number; z: number; heading: number } {
  const along = lane.from + lane.dir * s;
  if (lane.axis === "z") {
    return { x: lane.offset, z: along, heading: lane.dir > 0 ? 0 : Math.PI };
  }
  return { x: along, z: lane.offset, heading: lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

/** Distancia sobre el carril (s) de una coordenada del eje. */
function sOf(lane: Lane, coord: number): number {
  return (coord - lane.from) * lane.dir;
}

/** Autos por carril: pocos, pero siempre se ve pasar alguno. */
const CARS_PER_LANE = 3;

export function createTraffic(seed = 77): TrafficCar[] {
  const rand = seededRandom(seed);
  const cars: TrafficCar[] = [];
  LANES.forEach((lane, li) => {
    const len = laneLength(lane);
    for (let k = 0; k < CARS_PER_LANE; k += 1) {
      const v0 = lane.axis === "z" ? 9 + rand() * 3 : 7 + rand() * 2;
      const model = streetCarFor(cars.length);
      cars.push({
        id: `auto-${li}-${k}`,
        lane: li,
        s: ((k + rand() * 0.4) * len) / CARS_PER_LANE,
        v: v0 * 0.8,
        v0,
        length: model.lengthM,
        stoppedFor: 0,
        clearedAt: null,
        parked: false,
        model: STREET_CARS.indexOf(model),
      });
    }
  });
  return cars;
}

/** Aceleración IDM frente a un obstáculo a `gap` metros que va a `vAhead`. */
function idm(v: number, v0: number, gap: number | null, vAhead = 0): number {
  const free = 1 - (v / v0) ** 4;
  if (gap === null) return IDM.a * free;
  const dv = v - vAhead;
  const sStar = IDM.s0 + Math.max(0, v * IDM.T + (v * dv) / (2 * Math.sqrt(IDM.a * IDM.b)));
  return IDM.a * (free - (sStar / Math.max(0.1, gap)) ** 2);
}

function inBox(x: number, z: number, cx: number, cz: number): boolean {
  return Math.abs(x - cx) < BOX && Math.abs(z - cz) < BOX;
}

/**
 * Avanza el tránsito `dt` segundos. `walkers` son las posiciones de los
 * peatones (para frenarles). Devuelve el mismo arreglo, actualizado.
 */
export function stepTraffic(cars: TrafficCar[], walkers: readonly Vec2[], dt: number): TrafficCar[] {
  const h = Math.min(dt, 0.1);
  const poses = cars.map((c) => carPose(LANES[c.lane], c.s));

  cars.forEach((car, i) => {
    const lane = LANES[car.lane];
    if (car.parked) {
      // Entra cuando hay lugar al principio del carril.
      const blocked = cars.some((o, j) => j !== i && !o.parked && o.lane === car.lane && o.s < 14);
      if (!blocked) {
        car.parked = false;
        car.s = 0;
        car.v = car.v0 * 0.7;
        car.clearedAt = null;
        car.stoppedFor = 0;
      }
      return;
    }

    let gap: number | null = null;
    let vAhead = 0;
    const consider = (g: number, v: number) => {
      if (g < 0) return;
      if (gap === null || g < gap) {
        gap = g;
        vAhead = v;
      }
    };

    // Auto de adelante en el mismo carril.
    for (const o of cars) {
      if (o === car || o.parked || o.lane !== car.lane || o.s <= car.s) continue;
      consider(o.s - car.s - o.length, o.v);
    }

    // Peatones en el carril (cruzando por la senda o a mitad de cuadra).
    const front = car.s + car.length / 2;
    for (const [px, pz] of walkers) {
      const lateral = lane.axis === "z" ? px - lane.offset : pz - lane.offset;
      const onRoad = lane.axis === "z" ? Math.abs(px - lane.street) < STREET.roadHalf + 0.4 : Math.abs(pz - lane.street) < STREET.roadHalf + 0.4;
      if (!onRoad || Math.abs(lateral) > 1.9) continue;
      const ahead = sOf(lane, lane.axis === "z" ? pz : px) - front;
      if (ahead > -0.5 && ahead < 30) consider(ahead - 1.5, 0);
    }

    // Esquinas por delante (las calles transversales).
    for (const cross of CITY.lines) {
      const toCenter = sOf(lane, cross) - front;
      if (toCenter < -BOX || toCenter > 40) continue;
      const cx = lane.axis === "z" ? lane.street : cross;
      const cz = lane.axis === "z" ? cross : lane.street;
      if (lane.yields) {
        // PARE: detenerse del todo antes de la línea y cruzar sólo con la esquina libre.
        if (car.clearedAt === cross) continue;
        const toLine = toCenter - STOP_OFFSET;
        if (toLine < -1) continue;
        const near = toLine < 1.5 && car.v < 0.3;
        if (near) car.stoppedFor += h;
        const busy = cars.some((o, j) => {
          const ol = LANES[o.lane];
          if (o.parked || ol.axis === "x" || Math.abs(ol.street - cx) > 1) return false;
          const p = poses[j];
          if (inBox(p.x, p.z, cx, cz)) return true;
          // Llega en menos de ~2,5 s.
          const coming = (cz - p.z) * ol.dir;
          return coming > BOX && coming < BOX + Math.max(8, o.v * 2.5);
        });
        if (car.stoppedFor > 1 && !busy) {
          car.clearedAt = cross;
          car.stoppedFor = 0;
        } else {
          // El IDM se detiene a s0 del obstáculo: se corre la meta para frenar sobre la línea.
          consider(toLine + IDM.s0 - 0.6, 0);
        }
      } else {
        // Con prioridad: no entrar a la esquina si un auto de la transversal la está cruzando.
        const crossing = cars.some((o, j) => {
          const ol = LANES[o.lane];
          return !o.parked && ol.axis === "x" && Math.abs(ol.street - cz) < 1 && inBox(poses[j].x, poses[j].z, cx, cz);
        });
        const toBox = toCenter - BOX;
        if (crossing && toBox > 0) consider(toBox, 0);
      }
    }

    const acc = Math.max(-8, idm(car.v, car.v0, gap, vAhead));
    car.v = Math.max(0, car.v + acc * h);
    car.s += car.v * h;
    if (car.v > 0.5) car.stoppedFor = 0;
    if (car.s > laneLength(lane)) {
      car.parked = true;
      car.v = 0;
    }
  });
  return cars;
}
