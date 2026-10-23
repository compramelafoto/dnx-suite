/**
 * Poses del modelo de cuerpo entero.
 *
 * Cada articulación se describe con ángulos fáciles de leer (grados) y en el
 * espacio del personaje: +X = su izquierda, +Y = arriba, +Z = hacia adelante.
 * El render convierte estos ángulos en rotaciones de los huesos.
 */

export interface ArmPose {
  /** Abducción: 0 = brazo colgando, 90 = horizontal hacia el costado. */
  raise: number;
  /** Flexión: 0 = colgando, 90 = horizontal hacia adelante, negativo = hacia atrás. */
  forward: number;
  /** Codo: 0 = estirado, 150 = muy doblado. */
  elbow: number;
  /** Hacia dónde dobla el codo: 0 = adelante, 90 = hacia el cuerpo, −90 = hacia afuera. */
  roll: number;
}

export interface PoseParams {
  /** Cabeza: giro (+ = hacia su izquierda), asentir (+ = mira abajo), inclinar (+ = hacia su izquierda). */
  headTurn: number;
  headNod: number;
  headTilt: number;
  /** Torso: giro, inclinación lateral e inclinación hacia adelante. */
  torsoTurn: number;
  torsoBend: number;
  torsoLean: number;
  /** −1 = peso en la pierna derecha, 1 = en la izquierda (contrapposto). */
  weight: number;
  left: ArmPose;
  right: ArmPose;
}

export type PoseId =
  | "relaxed"
  | "contrapposto"
  | "hand-hip"
  | "hands-hips"
  | "arms-crossed"
  | "thinker"
  | "hands-head"
  | "pockets"
  | "wave"
  | "look-up"
  | "shy"
  | "tpose";

const DOWN: ArmPose = { raise: 8, forward: 4, elbow: 12, roll: 20 };

export const NEUTRAL_POSE: PoseParams = {
  headTurn: 0,
  headNod: 0,
  headTilt: 0,
  torsoTurn: 0,
  torsoBend: 0,
  torsoLean: 0,
  weight: 0,
  left: DOWN,
  right: DOWN,
};

export const POSES: { id: PoseId; label: string; hint: string; params: PoseParams }[] = [
  { id: "relaxed", label: "De pie, relajado", hint: "Punto de partida neutro.", params: NEUTRAL_POSE },
  {
    id: "contrapposto",
    label: "Contrapposto",
    hint: "El peso en una pierna: la cadera y los hombros se compensan. Da naturalidad.",
    params: {
      ...NEUTRAL_POSE,
      weight: 1,
      torsoBend: -4,
      headTilt: 5,
      left: { raise: 10, forward: 0, elbow: 18, roll: 25 },
      right: { raise: 6, forward: 6, elbow: 10, roll: 20 },
    },
  },
  {
    id: "hand-hip",
    label: "Mano en la cintura",
    hint: "Un brazo en jarra marca la silueta y separa el brazo del cuerpo.",
    params: {
      ...NEUTRAL_POSE,
      weight: -0.6,
      headTurn: 8,
      left: { raise: 48, forward: -12, elbow: 105, roll: 85 },
      right: { raise: 6, forward: 5, elbow: 12, roll: 20 },
    },
  },
  {
    id: "hands-hips",
    label: "Manos en la cintura",
    hint: "Pose de poder: hombros abiertos y triángulos de luz entre brazos y torso.",
    params: {
      ...NEUTRAL_POSE,
      left: { raise: 48, forward: -12, elbow: 105, roll: 85 },
      right: { raise: 48, forward: -12, elbow: 105, roll: 85 },
    },
  },
  {
    id: "arms-crossed",
    label: "Brazos cruzados",
    hint: "Retrato corporativo clásico. Cuidá que los brazos no tapen la luz del torso.",
    params: {
      ...NEUTRAL_POSE,
      torsoTurn: -10,
      headTurn: 10,
      left: { raise: 14, forward: 52, elbow: 102, roll: 78 },
      right: { raise: 12, forward: 58, elbow: 108, roll: 84 },
    },
  },
  {
    id: "thinker",
    label: "Mano en el mentón",
    hint: "Pensativo: la mano cerca de la cara agrega una segunda zona de luz.",
    params: {
      ...NEUTRAL_POSE,
      headNod: 6,
      headTilt: -4,
      left: { raise: 12, forward: 50, elbow: 100, roll: 80 },
      right: { raise: 8, forward: 64, elbow: 138, roll: 38 },
    },
  },
  {
    id: "hands-head",
    label: "Manos detrás de la cabeza",
    hint: "Relajado y abierto. Las axilas y codos reciben luz directa: ojo con los brillos.",
    params: {
      ...NEUTRAL_POSE,
      headNod: -6,
      left: { raise: 150, forward: -10, elbow: 100, roll: 118 },
      right: { raise: 150, forward: -10, elbow: 100, roll: 118 },
    },
  },
  {
    id: "pockets",
    label: "Manos en los bolsillos",
    hint: "Casual. Los codos separados del cuerpo evitan que el torso se vea ancho.",
    params: {
      ...NEUTRAL_POSE,
      weight: 0.5,
      left: { raise: 20, forward: -10, elbow: 38, roll: 70 },
      right: { raise: 20, forward: -10, elbow: 38, roll: 70 },
    },
  },
  {
    id: "wave",
    label: "Saludo",
    hint: "Un brazo en alto: probá cómo cambia la sombra del brazo sobre la cara.",
    params: {
      ...NEUTRAL_POSE,
      headTilt: -5,
      left: DOWN,
      right: { raise: 80, forward: 12, elbow: 100, roll: -90 },
    },
  },
  {
    id: "look-up",
    label: "Mirada arriba",
    hint: "La cara busca la luz: con luz alta los ojos se iluminan y desaparecen las sombras.",
    params: { ...NEUTRAL_POSE, headNod: -22, headTurn: 12, torsoLean: -4 },
  },
  {
    id: "shy",
    label: "Tímida / cabeza baja",
    hint: "Mentón abajo: los ojos quedan en sombra si la luz está muy alta.",
    params: {
      ...NEUTRAL_POSE,
      headNod: 20,
      headTilt: 8,
      torsoLean: 4,
      left: { raise: 6, forward: 22, elbow: 40, roll: 85 },
      right: { raise: 6, forward: 22, elbow: 40, roll: 85 },
    },
  },
  {
    id: "tpose",
    label: "Brazos abiertos",
    hint: "Brazos en cruz: sirve para estudiar cómo la luz cae en cada parte del cuerpo.",
    params: {
      ...NEUTRAL_POSE,
      left: { raise: 88, forward: 0, elbow: 0, roll: 0 },
      right: { raise: 88, forward: 0, elbow: 0, roll: 0 },
    },
  },
];

export function poseById(id: string): PoseParams {
  return POSES.find((p) => p.id === id)?.params ?? NEUTRAL_POSE;
}

type V3 = [number, number, number];
const D = Math.PI / 180;

function rotX([x, y, z]: V3, a: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}
function rotZ([x, y, z]: V3, a: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c, z];
}
function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
/** Rotación de Rodrigues de `v` alrededor del eje unitario `k`. */
function rotAround(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const kxv = cross(k, v);
  const kdv = dot(k, v);
  return [0, 1, 2].map((i) => v[i] * c + kxv[i] * s + k[i] * kdv * (1 - c)) as V3;
}

/**
 * Direcciones del brazo (hombro→codo y codo→muñeca) en espacio del personaje.
 * side = 1 para el brazo izquierdo (+X), −1 para el derecho.
 */
export function armDirections(arm: ArmPose, side: 1 | -1): { upper: V3; fore: V3 } {
  // Colgando, luego hacia adelante (flexión) y hacia el costado (abducción).
  let upper: V3 = [0, -1, 0];
  upper = rotX(upper, -arm.forward * D);
  upper = rotZ(upper, side * arm.raise * D);
  upper = normalize(upper);

  // Plano del codo: por defecto el antebrazo dobla hacia adelante.
  const fwd: V3 = [0, 0, 1];
  let bend = [0, 1, 2].map((i) => fwd[i] - upper[i] * dot(fwd, upper)) as V3;
  if (Math.hypot(...bend) < 1e-3) bend = [0, 1, 0];
  bend = normalize(bend);
  // roll positivo lleva la mano hacia el centro del cuerpo (−X para el izquierdo).
  bend = normalize(rotAround(bend, upper, side * arm.roll * D));

  const e = arm.elbow * D;
  const fore = normalize([0, 1, 2].map((i) => upper[i] * Math.cos(e) + bend[i] * Math.sin(e)) as V3);
  return { upper, fore };
}

/** Mezcla dos poses (t = 0 → a, 1 → b). Sirve para animar el cambio. */
export function lerpPose(a: PoseParams, b: PoseParams, t: number): PoseParams {
  const l = (x: number, y: number) => x + (y - x) * t;
  const arm = (p: ArmPose, q: ArmPose): ArmPose => ({
    raise: l(p.raise, q.raise),
    forward: l(p.forward, q.forward),
    elbow: l(p.elbow, q.elbow),
    roll: l(p.roll, q.roll),
  });
  return {
    headTurn: l(a.headTurn, b.headTurn),
    headNod: l(a.headNod, b.headNod),
    headTilt: l(a.headTilt, b.headTilt),
    torsoTurn: l(a.torsoTurn, b.torsoTurn),
    torsoBend: l(a.torsoBend, b.torsoBend),
    torsoLean: l(a.torsoLean, b.torsoLean),
    weight: l(a.weight, b.weight),
    left: arm(a.left, b.left),
    right: arm(a.right, b.right),
  };
}
