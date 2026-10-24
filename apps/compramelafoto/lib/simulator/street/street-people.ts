/**
 * Gente de la Calle 3D: quién camina por dónde y quién está quieto.
 *
 * Avatares Microsoft Rocketbox (MIT) con caminatas reales de la misma
 * biblioteca. Las caminatas vienen "en el lugar": el avance lo pone la escena
 * a la velocidad que corresponde a la zancada, para que los pies no patinen.
 */

import { BUILDING_LINE, STREET, type StreetLayout, type Vec2 } from "./street-layout";

export type Gait = "walk_neutral_01" | "walk_stroll_01" | "walk_fast_01" | "run_slow_01" | "run_neutral_01";

/** Trote y carrera: la velocidad sale del avance de la propia animación. */
export function isRunning(gait: Gait): boolean {
  return gait.startsWith("run_");
}
export type StandAction = "cell_phone_textmessage" | "cell_phone_talk_01" | "idle_look_around_01" | "gestic_talk_relaxed_01";

export interface StreetWalker {
  id: string;
  /** Id de figura del estudio (lib/simulator/studio-light/figures.ts). */
  figure: string;
  gait: Gait;
  path: readonly Vec2[];
  /** Arranca en este punto del recorrido (m), para que no salgan todos juntos. */
  startDistance: number;
}

export interface StreetStander {
  id: string;
  figure: string;
  action: StandAction;
  position: Vec2;
  /** Hacia dónde mira (rad, como rotation.y). */
  heading: number;
}

/** Femeninas y masculinas: el clip tiene que ser del mismo género que el esqueleto. */
const WOMEN = ["sofia", "laura", "julia", "martina", "valentina", "paula", "carla"];
const MEN = ["tomas", "ricardo", "mateo", "samuel", "lucas", "martin", "joaquin", "diego", "nico"];
/** Corredores con ropa deportiva y las vueltas largas por donde corren. */
const RUNNERS = ["paula", "diego", "carla", "nico"];
const RUNNING_LOOPS = ["vuelta-al-barrio", "vuelta-al-barrio-contramano", "vuelta-cuatro-manzanas", "vuelta-larga-sur", "vuelta-larga-este"];
/** Ricardo es un adulto mayor: camina despacio. */
const SLOW = new Set(["ricardo"]);

export function isWoman(figure: string): boolean {
  return WOMEN.includes(figure);
}

/** Las personas que andan por la calle (caminando, en bici o en moto). */
export const STREET_FIGURES: readonly string[] = [...WOMEN.slice(0, 4), ...MEN.slice(0, 5)];

export function planStreetPeople(layout: StreetLayout): { walkers: StreetWalker[]; standers: StreetStander[] } {
  const figures = STREET_FIGURES;
  const gaits: Gait[] = ["walk_neutral_01", "walk_stroll_01", "walk_fast_01", "walk_neutral_01"];
  const walkers: StreetWalker[] = [];
  layout.walkPaths.forEach((path, i) => {
    // Repartidos a lo largo del circuito: más gente en las vueltas largas
    // (uno cada ~130 m alcanza para que siempre se cruce alguien).
    const total = pathLength(path.points);
    // Como mucho 4 por recorrido: los largos no llenan la ciudad de gente.
    const count = Math.min(4, Math.max(1, Math.round(total / 130)));
    for (let k = 0; k < count; k += 1) {
      const n = walkers.length;
      const figure = figures[(i * 3 + k * 5) % figures.length];
      walkers.push({
        id: `w${n}`,
        figure,
        gait: SLOW.has(figure) ? "walk_stroll_01" : gaits[(i + k) % gaits.length],
        path: path.points,
        startDistance: (total * k) / count + ((n * 7) % 5),
      });
    }
  });

  // Corredores: uno o dos por vuelta larga, al trote o más rápido (para la larga exposición).
  let r = 0;
  for (const id of RUNNING_LOOPS) {
    const path = layout.walkPaths.find((p) => p.id === id);
    if (!path) continue;
    const total = pathLength(path.points);
    const count = id === "vuelta-al-barrio" ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      walkers.push({
        id: `run${r}`,
        figure: RUNNERS[r % RUNNERS.length],
        gait: r % 3 === 2 ? "run_neutral_01" : "run_slow_01",
        path: path.points,
        startDistance: (total * (k + 0.5)) / count + r * 17,
      });
      r += 1;
    }
  }

  // Contra la pared, para no quedar en el camino de los que caminan; otros en la plaza.
  const front = BUILDING_LINE - 0.3;
  const [cx, cz] = layout.plaza.center;
  const cart = layout.plaza.block.x0 + 11;
  const standers: StreetStander[] = [
    { id: "s0", figure: "valentina", action: "cell_phone_textmessage", position: [front, -20], heading: -Math.PI / 2 },
    { id: "s1", figure: "martin", action: "cell_phone_talk_01", position: [-front, -31], heading: Math.PI / 2 },
    { id: "s2", figure: "joaquin", action: "idle_look_around_01", position: [cx + 13, cz + 2], heading: -Math.PI / 2 },
    { id: "s3", figure: "julia", action: "gestic_talk_relaxed_01", position: [cart + 1.2, cz + 6], heading: -Math.PI / 2 },
    { id: "s4", figure: "lucas", action: "gestic_talk_relaxed_01", position: [cart + 0.2, cz + 7.6], heading: Math.PI },
    { id: "s5", figure: "sofia", action: "cell_phone_textmessage", position: [cx - 15, cz - 9], heading: Math.PI / 4 },
    { id: "s6", figure: "tomas", action: "idle_look_around_01", position: [STREET.roadHalf + 0.9, -(BUILDING_LINE + 2.5)], heading: Math.PI / 2 },
  ];
  return { walkers, standers };
}

/** Largo total de un recorrido cerrado (m), incluido el tramo que vuelve al inicio. */
export function pathLength(points: readonly Vec2[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

/**
 * Posición y rumbo a `distance` metros de un recorrido cerrado: al terminar la
 * vuelta sigue desde el principio, sin saltos ni medias vueltas.
 */
export function samplePath(points: readonly Vec2[], distance: number): { x: number; z: number; heading: number } {
  const total = pathLength(points);
  if (total <= 0) return { x: points[0]?.[0] ?? 0, z: points[0]?.[1] ?? 0, heading: 0 };
  let d = ((distance % total) + total) % total;
  for (let i = 0; i < points.length; i += 1) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[(i + 1) % points.length];
    const seg = Math.hypot(x1 - x0, z1 - z0);
    if (d <= seg || i === points.length - 1) {
      const t = seg > 0 ? Math.min(1, d / seg) : 0;
      // rotation.y que lleva +Z (frente del avatar) a la dirección de marcha.
      return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, heading: Math.atan2(x1 - x0, z1 - z0) };
    }
    d -= seg;
  }
  return { x: points[0][0], z: points[0][1], heading: 0 };
}

/** Metros de recorrido del punto del circuito más cercano a (x, z): para retomar la caminata. */
export function closestDistanceOnPath(points: readonly Vec2[], x: number, z: number): number {
  let best = 0;
  let bestD = Infinity;
  let acc = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[(i + 1) % points.length];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const seg = Math.hypot(dx, dz);
    const t = seg > 0 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (seg * seg))) : 0;
    const d = Math.hypot(x0 + dx * t - x, z0 + dz * t - z);
    if (d < bestD) {
      bestD = d;
      best = acc + t * seg;
    }
    acc += seg;
  }
  return best;
}
