/**
 * Gente de la Calle 3D: quién camina por dónde y quién está quieto.
 *
 * Avatares Microsoft Rocketbox (MIT) con caminatas reales de la misma
 * biblioteca. Las caminatas vienen "en el lugar": el avance lo pone la escena
 * a la velocidad que corresponde a la zancada, para que los pies no patinen.
 */

import { BUILDING_LINE, STREET, type StreetLayout, type Vec2 } from "./street-layout";

export type Gait = "walk_neutral_01" | "walk_stroll_01" | "walk_fast_01";
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
const WOMEN = ["sofia", "laura", "julia", "martina", "valentina"];
const MEN = ["tomas", "ricardo", "mateo", "samuel", "lucas", "martin", "joaquin"];
/** Ricardo es un adulto mayor: camina despacio. */
const SLOW = new Set(["ricardo"]);

export function isWoman(figure: string): boolean {
  return WOMEN.includes(figure);
}

export function planStreetPeople(layout: StreetLayout): { walkers: StreetWalker[]; standers: StreetStander[] } {
  const figures = [...WOMEN.slice(0, 4), ...MEN.slice(0, 5)];
  const gaits: Gait[] = ["walk_neutral_01", "walk_stroll_01", "walk_fast_01", "walk_neutral_01"];
  const walkers: StreetWalker[] = [];
  layout.walkPaths.forEach((path, i) => {
    // Dos personas por vereda larga, una por cada cruce.
    const count = path.id.startsWith("vereda") ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      const n = walkers.length;
      const figure = figures[(i * 3 + k * 5) % figures.length];
      walkers.push({
        id: `w${n}`,
        figure,
        gait: SLOW.has(figure) ? "walk_stroll_01" : gaits[(i + k) % gaits.length],
        path: path.points,
        startDistance: (k * 37 + i * 11) % 60,
      });
    }
  });

  const front = BUILDING_LINE - 0.6;
  const standers: StreetStander[] = [
    { id: "s0", figure: "valentina", action: "cell_phone_textmessage", position: [front, 15], heading: -Math.PI / 2 },
    { id: "s1", figure: "martin", action: "cell_phone_talk_01", position: [-front, -19], heading: Math.PI / 2 },
    { id: "s2", figure: "joaquin", action: "idle_look_around_01", position: [-(STREET.roadHalf + 0.9), BUILDING_LINE + 2.5], heading: -Math.PI / 2 },
    { id: "s3", figure: "julia", action: "gestic_talk_relaxed_01", position: [-front, 27], heading: Math.PI / 2 },
  ];
  return { walkers, standers };
}

/** Largo total de un recorrido (m). */
export function pathLength(points: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

/**
 * Posición y rumbo a `distance` metros de recorrido, yendo y volviendo
 * (al llegar a la punta da media vuelta).
 */
export function samplePath(points: readonly Vec2[], distance: number): { x: number; z: number; heading: number } {
  const total = pathLength(points);
  if (total <= 0) return { x: points[0]?.[0] ?? 0, z: points[0]?.[1] ?? 0, heading: 0 };
  const lap = ((distance % (2 * total)) + 2 * total) % (2 * total);
  const back = lap > total;
  let d = back ? 2 * total - lap : lap;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, z0] = points[i - 1];
    const [x1, z1] = points[i];
    const seg = Math.hypot(x1 - x0, z1 - z0);
    if (d <= seg || i === points.length - 1) {
      const t = seg > 0 ? Math.min(1, d / seg) : 0;
      const dx = (x1 - x0) * (back ? -1 : 1);
      const dz = (z1 - z0) * (back ? -1 : 1);
      // rotation.y que lleva +Z (frente del avatar) a la dirección de marcha.
      return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, heading: Math.atan2(dx, dz) };
    }
    d -= seg;
  }
  const last = points[points.length - 1];
  return { x: last[0], z: last[1], heading: 0 };
}
