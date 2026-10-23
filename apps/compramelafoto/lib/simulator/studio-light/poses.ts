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

/** Pierna: ángulos en el espacio del personaje. */
export interface LegPose {
  /** Flexión de cadera: 0 = vertical, 90 = muslo horizontal hacia adelante, negativo = atrás. */
  forward: number;
  /** Abducción: pierna hacia el costado. */
  out: number;
  /** Rodilla: 0 = estirada, 150 = muy doblada. */
  knee: number;
  /** Hacia dónde dobla la rodilla: 0 = la pantorrilla va hacia atrás, 90 = hacia adentro. */
  roll: number;
}

/**
 * Cómo se apoya el cuerpo. Define la altura y orientación de todo el modelo:
 * parado (pies en el piso), sentado en el banquito, en el piso, de rodillas
 * o acostado (boca arriba, de costado o boca abajo).
 */
export type PoseBase = "stand" | "stool" | "floor" | "kneel" | "lie-back" | "lie-side" | "lie-front";

/** Altura del asiento del banquito (m). */
export const STOOL_SEAT_Y = 0.62;

/**
 * Posición aproximada de los ojos para cada apoyo (m). La usan el fotómetro,
 * las luces que apuntan "a la cara" y el encuadre automático.
 */
export const BASE_HEAD: Record<PoseBase, [number, number, number]> = {
  stand: [0, 1.62, 0],
  stool: [0, 1.36, 0.03],
  floor: [0, 0.9, 0.04],
  kneel: [0, 1.2, 0.04],
  "lie-back": [0, 0.2, 0],
  "lie-side": [0, 0.26, 0],
  "lie-front": [0, 0.42, 0],
};

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
  /** Apoyo del cuerpo (parado, banquito, piso, rodillas, acostado). */
  base: PoseBase;
  /** Piernas a mano; null = postura natural de pie (con el peso del contrapposto). */
  legs: { left: LegPose; right: LegPose } | null;
  /** Pies en punta (0–1): relevé de ballet o pies estirados. */
  pointe: number;
}

export type PoseId = string;

export type PoseGroup = "De pie" | "Quebradas" | "Sentada" | "En el piso" | "Acostada" | "Ballet";

export const POSE_GROUPS: PoseGroup[] = ["De pie", "Quebradas", "Sentada", "En el piso", "Acostada", "Ballet"];

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
  base: "stand",
  legs: null,
  pointe: 0,
};

/** Piernas de pie, rectas: la referencia para mezclar con poses que no definen piernas. */
export const STAND_LEGS: { left: LegPose; right: LegPose } = {
  left: { forward: 0, out: 4, knee: 3, roll: 0 },
  right: { forward: 0, out: 4, knee: 3, roll: 0 },
};

const leg = (forward: number, out: number, knee: number, roll = 0): LegPose => ({ forward, out, knee, roll });
const arm = (raise: number, forward: number, elbow: number, roll: number): ArmPose => ({ raise, forward, elbow, roll });

/** Brazos "en corona" (quinta posición): arriba y redondeados, las manos se buscan. */
// Con el brazo levantado, el codo dobla hacia la cabeza con roll negativo.
const CORONA: ArmPose = { raise: 150, forward: 18, elbow: 78, roll: -92 };

/** Arma una pose a partir de la neutra cambiando sólo lo indicado. */
function pose(p: Partial<PoseParams>): PoseParams {
  return { ...NEUTRAL_POSE, ...p };
}

export interface PoseEntry {
  id: PoseId;
  label: string;
  hint: string;
  group: PoseGroup;
  params: PoseParams;
}

export const POSES: PoseEntry[] = [
  { id: "relaxed", label: "De pie, relajado", hint: "Punto de partida neutro.", group: "De pie", params: NEUTRAL_POSE },
  {
    id: "contrapposto",
    group: "De pie",
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
    group: "De pie",
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
    group: "De pie",
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
    group: "De pie",
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
    group: "De pie",
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
    group: "De pie",
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
    group: "De pie",
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
    group: "De pie",
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
    group: "De pie",
    label: "Mirada arriba",
    hint: "La cara busca la luz: con luz alta los ojos se iluminan y desaparecen las sombras.",
    params: { ...NEUTRAL_POSE, headNod: -22, headTurn: 12, torsoLean: -4 },
  },
  {
    id: "shy",
    group: "De pie",
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
    group: "De pie",
    label: "Brazos abiertos",
    hint: "Brazos en cruz: sirve para estudiar cómo la luz cae en cada parte del cuerpo.",
    params: {
      ...NEUTRAL_POSE,
      left: { raise: 88, forward: 0, elbow: 0, roll: 0 },
      right: { raise: 88, forward: 0, elbow: 0, roll: 0 },
    },
  },

  // ── Quebradas: posturas de moda, con cadera, torso y cabeza en distintas direcciones.
  {
    id: "hip-break",
    group: "Quebradas",
    label: "Cadera quebrada",
    hint: "Todo el peso en una pierna y la otra cruzando: la silueta forma una S.",
    params: pose({
      weight: 1,
      torsoBend: -10,
      headTilt: 10,
      headTurn: 10,
      left: arm(48, -12, 105, 85),
      legs: { left: leg(0, 6, 2), right: leg(12, -6, 25, 30) },
    }),
  },
  {
    id: "knee-in",
    group: "Quebradas",
    label: "Rodilla adentro",
    hint: "Una rodilla hacia adentro afina la figura y rompe la simetría.",
    params: pose({
      torsoBend: -8,
      headTilt: -8,
      right: arm(12, 22, 25, 60),
      legs: { left: leg(0, 5, 2), right: leg(10, -2, 32, 65) },
    }),
  },
  {
    id: "s-curve",
    group: "Quebradas",
    label: "Curva en S",
    hint: "Torso girado contra la cadera y un brazo detrás de la cabeza: pose editorial.",
    params: pose({
      weight: -1,
      torsoTurn: 20,
      torsoBend: -12,
      headTurn: -15,
      headTilt: 8,
      left: arm(140, -5, 110, 120),
      right: arm(48, -12, 105, 85),
      legs: { left: leg(10, 4, 22, 25), right: leg(0, 5, 2) },
    }),
  },
  {
    id: "over-shoulder",
    group: "Quebradas",
    label: "Mirada sobre el hombro",
    hint: "El cuerpo de espaldas y la cara a cámara: girá al modelo unos 120°.",
    params: pose({ torsoTurn: -30, headTurn: 45, headNod: 6, legs: { left: leg(10, 4, 18, 20), right: leg(0, 5, 2) } }),
  },
  {
    id: "lean-in",
    group: "Quebradas",
    label: "Inclinada hacia cámara",
    hint: "Manos en las rodillas y torso adelante: la cara se acerca y gana protagonismo.",
    params: pose({
      torsoLean: 26,
      headNod: -16,
      left: arm(14, 42, 25, 75),
      right: arm(14, 42, 25, 75),
      legs: { left: leg(22, 8, 40), right: leg(22, 8, 40) },
    }),
  },

  // ── Sentada en el banquito.
  {
    id: "stool-upright",
    group: "Sentada",
    label: "Sentada recta",
    hint: "Espalda derecha y manos sobre los muslos: la base del retrato sentado.",
    params: pose({
      base: "stool",
      left: arm(10, 34, 48, 62),
      right: arm(10, 34, 48, 62),
      legs: { left: leg(88, 7, 92), right: leg(88, 7, 92) },
    }),
  },
  {
    id: "stool-crossed",
    group: "Sentada",
    label: "Piernas cruzadas",
    hint: "Una pierna sobre la otra y las manos en la rodilla: elegante y cerrada.",
    params: pose({
      base: "stool",
      torsoTurn: 10,
      headTurn: -10,
      left: arm(8, 46, 38, 80),
      right: arm(10, 40, 46, 80),
      legs: { left: leg(86, 4, 88), right: leg(104, -14, 96, 38) },
    }),
  },
  {
    id: "stool-elbow",
    group: "Sentada",
    label: "Codo en la rodilla",
    hint: "Torso adelante y mentón en la mano: retrato pensativo y cercano.",
    params: pose({
      base: "stool",
      torsoLean: 24,
      headNod: -12,
      left: arm(10, 40, 45, 70),
      right: arm(6, 62, 130, 40),
      legs: { left: leg(88, 6, 96), right: leg(92, 4, 100) },
    }),
  },
  {
    id: "stool-sideways",
    group: "Sentada",
    label: "De costado, mirando atrás",
    hint: "El cuerpo de perfil y la cara vuelta a cámara: dinámica y con tensión.",
    params: pose({
      base: "stool",
      torsoTurn: 30,
      headTurn: -38,
      left: arm(10, 36, 46, 70),
      right: arm(16, 26, 30, 60),
      legs: { left: leg(90, 10, 96), right: leg(84, 12, 92) },
    }),
  },
  {
    id: "stool-one-leg",
    group: "Sentada",
    label: "Una pierna estirada",
    hint: "Manos atrás sobre el asiento y una pierna larga: relajada e informal.",
    params: pose({
      base: "stool",
      torsoLean: -8,
      left: arm(22, -32, 8, 0),
      right: arm(22, -32, 8, 0),
      legs: { left: leg(90, 6, 98), right: leg(62, 10, 28) },
    }),
  },

  // ── En el piso y de rodillas.
  {
    id: "floor-hug",
    group: "En el piso",
    label: "Abrazando las rodillas",
    hint: "Sentada en el piso, recogida: íntima, buena para luz suave y alta.",
    params: pose({
      base: "floor",
      torsoLean: 14,
      headNod: 4,
      left: arm(10, 68, 78, 88),
      right: arm(10, 68, 78, 88),
      // Muslos hacia arriba y adelante (rodillas al pecho) y pantorrillas hacia abajo.
      legs: { left: leg(118, 8, 126), right: leg(118, 8, 126) },
    }),
  },
  {
    id: "floor-recline",
    group: "En el piso",
    label: "Piernas estiradas, apoyada atrás",
    hint: "Manos atrás en el piso y piernas largas: relajada, de verano.",
    params: pose({
      base: "floor",
      torsoLean: -18,
      headNod: -6,
      left: arm(22, -42, 8, 0),
      right: arm(22, -42, 8, 0),
      legs: { left: leg(88, 6, 6), right: leg(80, 4, 26) },
    }),
  },
  {
    id: "kneel",
    group: "En el piso",
    label: "De rodillas",
    hint: "Rodillas en el piso y torso recto: la cámara baja suma presencia.",
    params: pose({
      base: "kneel",
      left: arm(10, 20, 30, 60),
      right: arm(10, 20, 30, 60),
      legs: { left: leg(0, 6, 95), right: leg(0, 6, 95) },
    }),
  },
  {
    id: "kneel-heels",
    group: "En el piso",
    label: "Sentada sobre los talones",
    hint: "Rodillas al piso y cola sobre los talones: compacta y serena.",
    params: pose({
      base: "kneel",
      torsoLean: 6,
      left: arm(8, 34, 40, 70),
      right: arm(8, 34, 40, 70),
      // Muslos horizontales y pantorrillas plegadas debajo.
      legs: { left: leg(86, 6, 166), right: leg(86, 6, 166) },
    }),
  },

  // ── Acostada (sobre la colchoneta).
  {
    id: "lie-back",
    group: "Acostada",
    label: "Boca arriba",
    hint: "Fotografiala desde arriba: probá la vista Arriba o subí la cámara con Caminar.",
    params: pose({
      base: "lie-back",
      headTurn: 25,
      left: arm(150, 0, 25, 0),
      right: arm(10, 30, 90, 80),
      legs: { left: leg(0, 4, 4), right: leg(48, 2, 92) },
    }),
  },
  {
    id: "lie-side",
    group: "Acostada",
    label: "De costado",
    hint: "Recostada de lado, piernas apenas dobladas: suave y cinematográfica.",
    params: pose({
      base: "lie-side",
      headNod: -6,
      left: arm(20, 30, 40, 70),
      right: arm(150, 10, 60, -40),
      legs: { left: leg(22, 0, 32), right: leg(30, 0, 44) },
    }),
  },
  {
    id: "lie-front",
    group: "Acostada",
    label: "Boca abajo, mentón en las manos",
    hint: "Pecho apoyado, codos al piso y piernas arriba: juvenil y divertida.",
    params: pose({
      base: "lie-front",
      torsoLean: -38,
      headNod: -20,
      left: arm(14, 150, 140, 70),
      right: arm(14, 150, 140, 70),
      legs: { left: leg(-4, 4, 95), right: leg(-4, 4, 70) },
    }),
  },

  // ── Ballet clásico.
  {
    id: "ballet-first",
    group: "Ballet",
    label: "Primera posición",
    hint: "Talones juntos y brazos redondeados adelante: el punto de partida de la danza.",
    params: pose({ left: arm(22, 38, 62, 88), right: arm(22, 38, 62, 88), legs: { left: leg(0, 4, 0, -60), right: leg(0, 4, 0, -60) } }),
  },
  {
    id: "ballet-plie",
    group: "Ballet",
    label: "Plié en segunda",
    hint: "Rodillas abiertas hacia afuera y brazos a los costados: base de todo salto.",
    params: pose({ left: arm(80, 14, 16, -10), right: arm(80, 14, 16, -10), legs: { left: leg(10, 22, 52, -75), right: leg(10, 22, 52, -75) } }),
  },
  {
    id: "ballet-releve",
    group: "Ballet",
    label: "Relevé en quinta",
    hint: "En puntas de pie y brazos en corona: la línea más larga del cuerpo.",
    params: pose({
      pointe: 1,
      headNod: -6,
      left: CORONA,
      right: CORONA,
      legs: { left: leg(0, 1, 0, -60), right: leg(0, 1, 0, -60) },
    }),
  },
  {
    id: "ballet-arabesque",
    group: "Ballet",
    label: "Arabesque",
    hint: "Una pierna atrás a la altura de la cadera y los brazos alargando la línea.",
    params: pose({
      pointe: 0.6,
      torsoLean: 16,
      headNod: -8,
      left: arm(12, 82, 6, 0),
      right: arm(78, -14, 6, 0),
      legs: { left: leg(0, 3, 0), right: leg(-88, 2, 0) },
    }),
  },
  {
    id: "ballet-attitude",
    group: "Ballet",
    label: "Attitude",
    hint: "Como el arabesque pero con la rodilla doblada: curva y elegante.",
    params: pose({
      pointe: 0.6,
      torsoLean: 8,
      left: CORONA,
      right: arm(80, 10, 18, -10),
      legs: { left: leg(0, 3, 0), right: leg(-78, 14, 82, 60) },
    }),
  },
  {
    id: "ballet-seconde",
    group: "Ballet",
    label: "Développé a la seconde",
    hint: "Pierna estirada al costado y bien alta: control y extensión.",
    params: pose({
      torsoBend: 6,
      left: arm(84, 10, 14, -10),
      right: arm(84, 10, 14, -10),
      legs: { left: leg(0, 2, 0), right: leg(6, 88, 0) },
    }),
  },
  {
    id: "ballet-passe",
    group: "Ballet",
    label: "Passé en relevé",
    hint: "La punta del pie en la rodilla de apoyo: la posición de la pirueta.",
    params: pose({
      pointe: 1,
      left: CORONA,
      right: CORONA,
      legs: { left: leg(0, 1, 0), right: leg(52, 34, 128, -62) },
    }),
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
  const legMix = (p: LegPose, q: LegPose): LegPose => ({
    forward: l(p.forward, q.forward),
    out: l(p.out, q.out),
    knee: l(p.knee, q.knee),
    roll: l(p.roll, q.roll),
  });
  const armMix = (p: ArmPose, q: ArmPose): ArmPose => ({
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
    left: armMix(a.left, b.left),
    right: armMix(a.right, b.right),
    // El apoyo no se mezcla: cambia de una vez (la transición es de brazos y piernas).
    base: t < 0.5 ? a.base : b.base,
    legs:
      a.legs || b.legs
        ? {
            left: legMix((a.legs ?? STAND_LEGS).left, (b.legs ?? STAND_LEGS).left),
            right: legMix((a.legs ?? STAND_LEGS).right, (b.legs ?? STAND_LEGS).right),
          }
        : null,
    pointe: l(a.pointe, b.pointe),
  };
}

/**
 * Direcciones de la pierna (cadera→rodilla y rodilla→tobillo) en espacio del personaje.
 * side = 1 para la pierna izquierda (+X), −1 para la derecha.
 */
export function legDirections(legPose: LegPose, side: 1 | -1): { thigh: V3; calf: V3 } {
  let thigh: V3 = [0, -1, 0];
  thigh = rotX(thigh, -legPose.forward * D);
  thigh = rotZ(thigh, side * legPose.out * D);
  thigh = normalize(thigh);
  // La rodilla dobla "hacia atrás" respecto del muslo: con el muslo vertical la
  // pantorrilla va hacia −Z; con el muslo horizontal adelante, hacia abajo.
  let bend = normalize(cross([1, 0, 0], thigh));
  bend = normalize(rotAround(bend, thigh, side * legPose.roll * D));
  const k = legPose.knee * D;
  const calf = normalize([0, 1, 2].map((i) => thigh[i] * Math.cos(k) + bend[i] * Math.sin(k)) as V3);
  return { thigh, calf };
}

/** Un cuadro clave de una coreografía. */
export interface SequenceKey {
  /** Segundos desde el inicio. */
  t: number;
  pose: PoseParams;
  /** Altura del cuerpo sobre el piso (saltos), en m. */
  lift?: number;
  /** Giro sobre sí mismo (piruetas), en grados acumulados. */
  spin?: number;
}

export interface Sequence {
  id: string;
  label: string;
  hint: string;
  keys: SequenceKey[];
}

const PLIE = pose({
  left: arm(30, -25, 20, 0),
  right: arm(30, -25, 20, 0),
  torsoLean: 12,
  legs: { left: leg(28, 6, 60), right: leg(28, 6, 60) },
});
const BALLET_PLIE = POSES.find((p) => p.id === "ballet-plie")!.params;
const PASSE = POSES.find((p) => p.id === "ballet-passe")!.params;
const RELEVE = POSES.find((p) => p.id === "ballet-releve")!.params;

/** Coreografías armadas cuadro a cuadro sobre el sistema de poses. */
export const SEQUENCES: Sequence[] = [
  {
    id: "seq-jump",
    label: "Saltar",
    hint: "Para congelar el salto: obturador rápido o flash (el flash dura menos que el obturador).",
    keys: [
      { t: 0, pose: NEUTRAL_POSE },
      { t: 0.45, pose: PLIE },
      {
        t: 0.75,
        lift: 0.5,
        pose: pose({ pointe: 1, headNod: -12, left: arm(165, 15, 10, 0), right: arm(165, 15, 10, 0), legs: { left: leg(-6, 6, 18), right: leg(-6, 6, 18) } }),
      },
      { t: 0.95, lift: 0.42, pose: pose({ pointe: 0.8, left: arm(150, 20, 20, 0), right: arm(150, 20, 20, 0), legs: { left: leg(30, 8, 70), right: leg(30, 8, 70) } }) },
      { t: 1.2, lift: 0, pose: PLIE },
      { t: 1.6, pose: NEUTRAL_POSE },
      { t: 2.4, pose: NEUTRAL_POSE },
    ],
  },
  {
    id: "seq-grand-jete",
    label: "Gran salto de ballet",
    hint: "Grand jeté: las piernas se abren en el aire. Disparo en el punto más alto.",
    keys: [
      { t: 0, pose: RELEVE },
      { t: 0.5, pose: BALLET_PLIE },
      {
        t: 0.95,
        lift: 0.55,
        pose: pose({
          pointe: 1,
          torsoLean: 6,
          headNod: -10,
          left: arm(150, 30, 30, -70),
          right: arm(84, -10, 10, 0),
          legs: { left: leg(88, 2, 0), right: leg(-82, 2, 0) },
        }),
      },
      { t: 1.25, lift: 0.3, pose: pose({ pointe: 1, left: arm(140, 30, 30, -70), right: arm(84, -10, 10, 0), legs: { left: leg(40, 2, 20), right: leg(-40, 2, 10) } }) },
      { t: 1.5, lift: 0, pose: BALLET_PLIE },
      { t: 2.1, pose: RELEVE },
      { t: 2.8, pose: RELEVE },
    ],
  },
  {
    id: "seq-pirouette",
    label: "Pirueta",
    hint: "Un giro completo en passé. Con flash se congela; con obturador lento queda un barrido.",
    keys: [
      { t: 0, pose: BALLET_PLIE },
      { t: 0.4, pose: PASSE, spin: 0 },
      { t: 1.2, pose: PASSE, spin: 360 },
      { t: 1.5, pose: RELEVE, spin: 360 },
      { t: 2.2, pose: BALLET_PLIE, spin: 360 },
    ],
  },
  {
    id: "seq-hair-flip",
    label: "Sacudir el pelo",
    hint: "Cabeza abajo y latigazo hacia atrás. El pelo acompaña a la cabeza (no hay mechones sueltos).",
    keys: [
      { t: 0, pose: NEUTRAL_POSE },
      {
        t: 0.7,
        pose: pose({ headNod: 55, torsoLean: 48, left: arm(10, 40, 20, 40), right: arm(10, 40, 20, 40), legs: { left: leg(12, 8, 26), right: leg(12, 8, 26) } }),
      },
      {
        t: 0.95,
        pose: pose({ headNod: -42, headTilt: -6, torsoLean: -16, left: arm(36, -26, 30, 0), right: arm(36, -26, 30, 0), legs: { left: leg(4, 8, 10), right: leg(4, 8, 10) } }),
      },
      { t: 1.5, pose: pose({ headNod: -30, torsoLean: -10, left: arm(30, -20, 30, 0), right: arm(30, -20, 30, 0) }) },
      { t: 2.3, pose: NEUTRAL_POSE },
      { t: 2.8, pose: NEUTRAL_POSE },
    ],
  },
];

/** Pose, altura y giro de una coreografía en el instante t (se repite en bucle). */
export function sampleSequence(seq: Sequence, time: number): { pose: PoseParams; lift: number; spin: number } {
  const end = seq.keys[seq.keys.length - 1].t;
  const t = ((time % end) + end) % end;
  let i = 0;
  while (i < seq.keys.length - 2 && seq.keys[i + 1].t <= t) i++;
  const a = seq.keys[i];
  const b = seq.keys[i + 1];
  const raw = (t - a.t) / Math.max(1e-6, b.t - a.t);
  const k = raw * raw * (3 - 2 * raw);
  const lift = (a.lift ?? 0) + ((b.lift ?? 0) - (a.lift ?? 0)) * k;
  // El giro acumulado se interpola linealmente; vuelve a 0 al reiniciar el bucle.
  const spin = (a.spin ?? 0) + ((b.spin ?? a.spin ?? 0) - (a.spin ?? 0)) * raw;
  return { pose: lerpPose(a.pose, b.pose, k), lift, spin };
}

export function baseHead(base: PoseBase): [number, number, number] {
  return BASE_HEAD[base];
}
