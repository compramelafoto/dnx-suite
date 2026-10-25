/**
 * Expresiones faciales de los avatares Rocketbox (versión "_facial").
 *
 * Cada avatar trae 175 formas de cara en cuatro juegos (ARKit, Vive "SR",
 * "HB" y unidades de acción FACS "AU"), más 15 visemas para hablar. Cada
 * forma por separado mueve la cara apenas 5 a 9 mm: una expresión real suma
 * varios músculos, así que cada expresión combina formas de varios juegos.
 * Este módulo sólo calcula pesos (0…1) por nombre de forma, sin three.js:
 * parpadeo natural, expresiones con transición suave y boca que habla.
 */

/** Formas que se conservan al cargar (el resto se descarta para ahorrar memoria de video). */
export const FACE_SHAPES = [
  "AK_01_BrowDownLeft",
  "AK_02_BrowDownRight",
  "AK_03_BrowInnerUp",
  "AK_04_BrowOuterUpLeft",
  "AK_05_BrowOuterUpRight",
  "AK_07_CheekSquintLeft",
  "AK_08_CheekSquintRight",
  "AK_09_EyeBlinkLeft",
  "AK_10_EyeBlinkRight",
  "AK_19_EyeSquintLeft",
  "AK_20_EyeSquintRight",
  "AK_21_EyeWideLeft",
  "AK_22_EyeWideRight",
  "AK_25_JawOpen",
  "AK_28_MouthDimpleLeft",
  "AK_29_MouthDimpleRight",
  "AK_30_MouthFrownLeft",
  "AK_31_MouthFrownRight",
  "AK_34_MouthLowerDownLeft",
  "AK_35_MouthLowerDownRight",
  "AK_36_MouthPressLeft",
  "AK_37_MouthPressRight",
  "AK_38_MouthPucker",
  "AK_44_MouthSmileLeft",
  "AK_45_MouthSmileRight",
  "AK_48_MouthUpperUpLeft",
  "AK_49_MouthUpperUpRight",
  "AK_50_NoseSneerLeft",
  "AK_51_NoseSneerRight",
  "HB_07_MouthSmile",
  "SR_04_Eye_Frown",
  "SR_32_Mouth_Sad_Left",
  "SR_33_Mouth_Sad_Right",
  "SR_34_Mouth_Smile_Left",
  "SR_35_Mouth_Smile_Right",
  "AU_01_InnerBrowRaiser",
  "AU_02_OuterBrowRaiser",
  "AU_04_BrowLowerer",
  "AU_06_CheekRaiser",
  "AU_09_NoseWrinkler",
  "AU_12_LipCornerPuller",
  "AU_15_LipCornerDepressor",
  "AA_VI_00_Sil",
  "AA_VI_01_PP",
  "AA_VI_02_FF",
  "AA_VI_03_TH",
  "AA_VI_04_DD",
  "AA_VI_05_KK",
  "AA_VI_06_CH",
  "AA_VI_07_SS",
  "AA_VI_08_nn",
  "AA_VI_09_RR",
  "AA_VI_10_aa",
  "AA_VI_11_E",
  "AA_VI_12_I",
  "AA_VI_13_O",
  "AA_VI_14_U",
] as const;

export type FaceShape = (typeof FACE_SHAPES)[number];
export type FaceWeights = Partial<Record<FaceShape, number>>;

export type Expression = "neutral" | "smile" | "laugh" | "serious" | "angry" | "sad" | "surprised" | "pensive";

export const EXPRESSIONS: { id: Expression; label: string }[] = [
  { id: "neutral", label: "Natural" },
  { id: "smile", label: "Sonreír" },
  { id: "laugh", label: "Reírse" },
  { id: "serious", label: "Serio" },
  { id: "angry", label: "Enojado" },
  { id: "sad", label: "Triste" },
  { id: "surprised", label: "Sorprendido" },
  { id: "pensive", label: "Pensativo" },
];

/** Pesos de cada expresión (una sonrisa real también achina los ojos y sube las mejillas). */
export const EXPRESSION_WEIGHTS: Record<Expression, FaceWeights> = {
  neutral: {},
  smile: {
    AK_44_MouthSmileLeft: 1,
    AK_45_MouthSmileRight: 1,
    HB_07_MouthSmile: 0.7,
    SR_34_Mouth_Smile_Left: 0.6,
    SR_35_Mouth_Smile_Right: 0.6,
    AU_12_LipCornerPuller: 0.5,
    AU_06_CheekRaiser: 0.6,
    AK_07_CheekSquintLeft: 0.5,
    AK_08_CheekSquintRight: 0.5,
    AK_19_EyeSquintLeft: 0.3,
    AK_20_EyeSquintRight: 0.3,
    AK_28_MouthDimpleLeft: 0.3,
    AK_29_MouthDimpleRight: 0.3,
  },
  laugh: {
    AK_44_MouthSmileLeft: 1,
    AK_45_MouthSmileRight: 1,
    HB_07_MouthSmile: 1,
    SR_34_Mouth_Smile_Left: 0.8,
    SR_35_Mouth_Smile_Right: 0.8,
    AU_12_LipCornerPuller: 0.8,
    AU_06_CheekRaiser: 1,
    AK_25_JawOpen: 0.4,
    AK_07_CheekSquintLeft: 0.8,
    AK_08_CheekSquintRight: 0.8,
    AK_19_EyeSquintLeft: 0.6,
    AK_20_EyeSquintRight: 0.6,
    AK_48_MouthUpperUpLeft: 0.4,
    AK_49_MouthUpperUpRight: 0.4,
    AK_03_BrowInnerUp: 0.2,
  },
  serious: {
    AK_36_MouthPressLeft: 0.6,
    AK_37_MouthPressRight: 0.6,
    AU_04_BrowLowerer: 0.25,
    AK_01_BrowDownLeft: 0.3,
    AK_02_BrowDownRight: 0.3,
  },
  angry: {
    AU_04_BrowLowerer: 0.63,
    AK_01_BrowDownLeft: 0.7,
    AK_02_BrowDownRight: 0.7,
    SR_04_Eye_Frown: 0.35,
    AK_50_NoseSneerLeft: 0.49,
    AK_51_NoseSneerRight: 0.49,
    AU_09_NoseWrinkler: 0.42,
    AK_30_MouthFrownLeft: 0.49,
    AK_31_MouthFrownRight: 0.49,
    AU_15_LipCornerDepressor: 0.28,
    AK_36_MouthPressLeft: 0.28,
    AK_37_MouthPressRight: 0.28,
    AK_19_EyeSquintLeft: 0.32,
    AK_20_EyeSquintRight: 0.32,
  },
  sad: {
    AK_03_BrowInnerUp: 0.7,
    AU_01_InnerBrowRaiser: 0.56,
    SR_32_Mouth_Sad_Left: 0.63,
    SR_33_Mouth_Sad_Right: 0.63,
    AU_15_LipCornerDepressor: 0.49,
    AK_30_MouthFrownLeft: 0.49,
    AK_31_MouthFrownRight: 0.49,
    AK_34_MouthLowerDownLeft: 0.14,
    AK_35_MouthLowerDownRight: 0.14,
  },
  surprised: {
    AK_03_BrowInnerUp: 0.7,
    AK_04_BrowOuterUpLeft: 0.7,
    AK_05_BrowOuterUpRight: 0.7,
    AU_01_InnerBrowRaiser: 0.56,
    AU_02_OuterBrowRaiser: 0.63,
    AK_21_EyeWideLeft: 0.7,
    AK_22_EyeWideRight: 0.7,
    AK_25_JawOpen: 0.24,
  },
  pensive: {
    AK_03_BrowInnerUp: 0.4,
    AU_04_BrowLowerer: 0.2,
    AK_36_MouthPressLeft: 0.35,
    AK_37_MouthPressRight: 0.35,
    AK_38_MouthPucker: 0.25,
  },
};

/** Semilla → número pseudoaleatorio estable en [0, 1). */
function hash01(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const BLINK_SECONDS = 0.15;

/**
 * Peso del parpadeo (0 abierto … 1 cerrado) en el instante `t` (s). Cada
 * persona tiene su ritmo (`seed`): entre 2 y 6 s, a veces un parpadeo doble.
 */
export function blinkWeight(t: number, seed: number): number {
  let start = hash01(seed) * 3;
  for (let i = 0; i < 10000 && start <= t; i += 1) {
    const r = hash01(seed * 31 + i);
    const gap = 2 + r * 4;
    const double = r > 0.85;
    const end = start + BLINK_SECONDS * (double ? 2.6 : 1);
    if (t < end) {
      const local = (t - start) % (BLINK_SECONDS * 1.3);
      const x = Math.min(1, local / BLINK_SECONDS);
      // Cierra rápido y abre un poco más lento.
      return x < 0.4 ? x / 0.4 : Math.max(0, 1 - (x - 0.4) / 0.6);
    }
    start += gap;
  }
  return 0;
}

/** Visema aproximado de cada letra (español). */
function visemeFor(ch: string): FaceShape {
  if ("aá".includes(ch)) return "AA_VI_10_aa";
  if ("eé".includes(ch)) return "AA_VI_11_E";
  if ("ií y".includes(ch) && ch !== " ") return "AA_VI_12_I";
  if ("oó".includes(ch)) return "AA_VI_13_O";
  if ("uúü".includes(ch)) return "AA_VI_14_U";
  if ("pbm".includes(ch)) return "AA_VI_01_PP";
  if ("fv".includes(ch)) return "AA_VI_02_FF";
  if ("td".includes(ch)) return "AA_VI_04_DD";
  if ("kgjq".includes(ch)) return "AA_VI_05_KK";
  if ("chñ".includes(ch)) return "AA_VI_06_CH";
  if ("szx".includes(ch)) return "AA_VI_07_SS";
  if ("nl".includes(ch)) return "AA_VI_08_nn";
  if ("r".includes(ch)) return "AA_VI_09_RR";
  return "AA_VI_00_Sil";
}

/** Segundos por letra al hablar. */
export const SPEECH_SECONDS_PER_CHAR = 0.065;

export function speechDuration(text: string): number {
  return Math.min(4, text.length * SPEECH_SECONDS_PER_CHAR);
}

/**
 * Pesos de la boca a `t` segundos de empezar a decir `text`: la letra actual
 * se funde con la siguiente, y la mandíbula acompaña a las vocales.
 */
export function speechWeights(text: string, t: number): FaceWeights {
  const clean = text.toLowerCase().replace(/[^a-záéíóúüñ ]/g, "");
  if (!clean || t < 0 || t >= clean.length * SPEECH_SECONDS_PER_CHAR) return {};
  const pos = t / SPEECH_SECONDS_PER_CHAR;
  const i = Math.floor(pos);
  const f = pos - i;
  const a = visemeFor(clean[i]);
  const b = visemeFor(clean[Math.min(clean.length - 1, i + 1)]);
  const out: FaceWeights = {};
  out[a] = (out[a] ?? 0) + (1 - f) * 0.9;
  out[b] = (out[b] ?? 0) + f * 0.9;
  const open = (["AA_VI_10_aa", "AA_VI_13_O", "AA_VI_11_E"] as FaceShape[]).includes(a) ? 0.25 : 0.08;
  out.AK_25_JawOpen = open * (1 - f) + 0.08 * f;
  return out;
}

/** Suma de pesos con tope en 1 (la sonrisa más el habla no deben pasarse). */
export function mixWeights(...layers: FaceWeights[]): FaceWeights {
  const out: FaceWeights = {};
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer) as [FaceShape, number][]) {
      out[k] = Math.min(1, (out[k] ?? 0) + v);
    }
  }
  return out;
}
