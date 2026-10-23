/**
 * Tránsito de la Calle 3D.
 *
 * Calles de mano única, como en el centro de Rosario: la principal sube hacia
 * +Z en dos carriles (al costado izquierdo están los estacionados) y la
 * transversal va hacia −X con un PARE antes de la esquina. Cada auto maneja
 * con el modelo de conductor inteligente (IDM): mantiene distancia con el de
 * adelante, frena ante peatones en su carril y respeta el PARE. Los autos
 * entran y salen lejos, dentro de la bruma, así nunca aparecen de golpe.
 */

import { STREET_CARS, streetCarFor } from "./street-cars";
import { STREET, seededRandom, type Vec2 } from "./street-layout";

export interface Lane {
  id: string;
  /** Eje por el que se avanza. */
  axis: "x" | "z";
  /** Sentido sobre ese eje. */
  dir: 1 | -1;
  /** Coordenada lateral del centro del carril. */
  offset: number;
  /** Coordenada de entrada y de salida sobre el eje. */
  from: number;
  to: number;
  /** Coordenada de la línea de PARE sobre el eje, si la hay. */
  stopAt?: number;
}

const STOP_LINE = STREET.roadHalf + STREET.sidewalk + 0.5;
const EDGE = 82;

export const LANES: readonly Lane[] = [
  { id: "principal-1", axis: "z", dir: 1, offset: -0.55, from: -EDGE, to: EDGE },
  { id: "principal-2", axis: "z", dir: 1, offset: 2.25, from: -EDGE, to: EDGE },
  { id: "transversal", axis: "x", dir: -1, offset: 0, from: 66, to: -66, stopAt: STOP_LINE },
];

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
  /** Ya pasó el PARE en esta vuelta. */
  clearedStop: boolean;
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

export function createTraffic(seed = 77): TrafficCar[] {
  const rand = seededRandom(seed);
  const cars: TrafficCar[] = [];
  LANES.forEach((lane, li) => {
    const count = lane.axis === "z" ? 4 : 3;
    const len = laneLength(lane);
    for (let k = 0; k < count; k += 1) {
      const v0 = lane.axis === "z" ? 9 + rand() * 3 : 7 + rand() * 2;
      const model = streetCarFor(cars.length);
      cars.push({
        id: `auto-${li}-${k}`,
        lane: li,
        s: ((k + rand() * 0.4) * len) / count,
        v: v0 * 0.8,
        v0,
        length: model.lengthM,
        stoppedFor: 0,
        clearedStop: false,
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

/** La esquina: el cuadrado donde se cruzan las dos calzadas. */
const BOX = STREET.roadHalf + 0.5;

function inBox(x: number, z: number): boolean {
  return Math.abs(x) < BOX && Math.abs(z) < BOX;
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
        car.clearedStop = false;
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
      const onRoad = lane.axis === "z" ? Math.abs(px) < STREET.roadHalf + 0.4 : Math.abs(pz) < STREET.roadHalf + 0.4;
      if (!onRoad || Math.abs(lateral) > 1.9) continue;
      const ahead = sOf(lane, lane.axis === "z" ? pz : px) - front;
      if (ahead > -0.5 && ahead < 30) consider(ahead - 1.5, 0);
    }

    // PARE: detenerse del todo antes de la línea y cruzar sólo con la esquina libre.
    if (lane.stopAt !== undefined && !car.clearedStop) {
      const toLine = sOf(lane, lane.stopAt) - front;
      if (toLine > -1) {
        const near = toLine < 1.5 && car.v < 0.3;
        if (near) car.stoppedFor += h;
        const mainBusy = cars.some((o) => {
          if (o.parked || LANES[o.lane].axis !== "z") return false;
          const p = carPose(LANES[o.lane], o.s);
          // Ocupa la esquina o llega en menos de ~2,5 s.
          return inBox(p.x, p.z) || (p.z < -BOX && p.z > -BOX - Math.max(8, o.v * 2.5));
        });
        if (car.stoppedFor > 1 && !mainBusy) car.clearedStop = true;
        // El IDM se detiene a s0 del obstáculo: se corre la meta para frenar sobre la línea.
        else consider(toLine + IDM.s0 - 0.6, 0);
      }
    }

    // En la principal: no entrar a la esquina si un auto de la transversal la está cruzando.
    if (lane.axis === "z") {
      const crossInBox = cars.some((o) => !o.parked && LANES[o.lane].axis === "x" && inBox(poses[cars.indexOf(o)].x, poses[cars.indexOf(o)].z));
      const toBox = sOf(lane, -BOX) - front;
      if (crossInBox && toBox > 0) consider(toBox, 0);
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
