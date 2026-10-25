/**
 * Curso de fotografía de Cam Of Duty: lecciones con una tarea que se hace en
 * uno de los simuladores y se corrige sola con los datos de la toma.
 */

export type CourseLevel = "inicial" | "avanzado";
export type CourseSimulator = "calle" | "estudio";

/** Qué tipo de cosa quedó enfocada en la calle. */
export type ShotSubjectKind = "persona" | "corredor" | "auto" | "bici" | "moto" | "ninguno";

/** Datos de una toma en la calle que usa el corrector (se arman al obturar). */
export interface StreetShot {
  sim: "calle";
  iso: number;
  /** Tiempo de exposición en segundos. */
  shutterSeconds: number;
  aperture: number;
  focalLengthMm: number;
  whiteBalance: number;
  mode: "M" | "A" | "S";
  exposureCompensation: number;
  /** Desvío de la exposición en pasos (0 = correcta, + sobreexpuesta). */
  exposureError: number;
  metering: "MATRIX" | "CENTER" | "SPOT";
  focusMode: string;
  focusDistanceM: number;
  /** Lo que quedó enfocado y cómo se movía. */
  subject: {
    kind: ShotSubjectKind;
    distanceM: number | null;
    speedMps: number;
    /** Posición en el cuadro (0–1, desde arriba a la izquierda), si se ve. */
    frameX: number | null;
    frameY: number | null;
  };
  /** Qué tanto acompañó la cámara al sujeto durante la exposición (0–1), si hubo barrido. */
  panningMatch: number | null;
  timeOfDayMinutes: number;
  /** Altura del sol (grados): negativa de noche. */
  sunElevationDeg: number;
  weather: "sunny" | "cloudy" | "rain";
  cameraHeightM: number;
  /** Inclinación de la cámara (grados, 0 = horizonte derecho). */
  rollDeg: number;
  /** Distancia al charco visible más cercano (m), si hay uno a la vista. */
  puddleDistanceM: number | null;
}

export type StudioPattern = "none" | "butterfly" | "loop" | "rembrandt" | "split" | "rim" | "underlight" | "top" | "flat";

/** Datos de una toma en el estudio (de su fotómetro). */
export interface StudioShot {
  sim: "estudio";
  iso: number;
  shutterSeconds: number;
  aperture: number;
  focalLengthMm: number;
  whiteBalance: number;
  /** Exposición de la cara (EV, 0 = correcta). */
  exposureError: number;
  pattern: StudioPattern;
  /** Relación luz/sombra (3 = 3:1) o null si no hay relleno. */
  ratio: number | null;
  side: "broad" | "short" | null;
  /** Fondo respecto de la cara (EV). */
  backgroundEv: number | null;
  overSync: boolean;
  lightsOn: number;
  /** Modificador de la luz principal. */
  keyModifier: string | null;
  hasHairLight: boolean;
  hasBackgroundLight: boolean;
  subjectYaw: number;
}

export type Shot = StreetShot | StudioShot;

/** Requisitos que el corrector sabe revisar. */
export type Criterion =
  | { type: "exposure"; tolerance: number }
  | { type: "exposureRange"; min: number; max: number }
  | { type: "shutterMax"; seconds: number }
  | { type: "shutterMin"; seconds: number }
  | { type: "apertureMax"; f: number }
  | { type: "apertureMin"; f: number }
  | { type: "isoMax"; iso: number }
  | { type: "isoMin"; iso: number }
  | { type: "focalMax"; mm: number }
  | { type: "focalMin"; mm: number }
  | { type: "mode"; modes: ("M" | "A" | "S")[] }
  | { type: "metering"; modes: ("MATRIX" | "CENTER" | "SPOT")[] }
  | { type: "compensation"; min: number; max: number }
  | { type: "compensationUsed" }
  | { type: "whiteBalance"; min: number; max: number }
  | { type: "focusMode"; modes: string[] }
  | { type: "subject"; kinds: ShotSubjectKind[] }
  | { type: "subjectSharp" }
  | { type: "subjectDistanceMax"; meters: number }
  | { type: "frozen"; maxBlurM: number }
  | { type: "motionBlur"; minBlurM: number }
  | { type: "panning"; minMatch: number }
  | { type: "backgroundBlur"; minPercent: number }
  | { type: "deepFocus"; maxPercent: number }
  | { type: "thirds"; tolerance: number }
  | { type: "level"; maxDeg: number }
  | { type: "sunBetween"; minDeg: number; maxDeg: number }
  | { type: "weather"; kinds: ("sunny" | "cloudy" | "rain")[] }
  | { type: "cameraHeightMax"; meters: number }
  | { type: "puddleNear"; meters: number }
  | { type: "pattern"; patterns: StudioPattern[] }
  | { type: "ratio"; min: number; max: number }
  | { type: "side"; side: "broad" | "short" }
  | { type: "backgroundEv"; min: number; max: number }
  | { type: "noOverSync" }
  | { type: "lightsOnMin"; count: number }
  | { type: "keyModifier"; modifiers: string[] }
  | { type: "hairLight" }
  | { type: "backgroundLight" };

export interface LessonCriterion {
  criterion: Criterion;
  /** Texto de la consigna ("Tiempo de exposición de 1/1000 o más rápido"). */
  label: string;
  /** Obligatorio para aprobar; los opcionales suman estrellas (hasta 3). */
  required: boolean;
}

/** Cómo se prepara el simulador al abrir la tarea. */
export interface LessonSetup {
  timeOfDayMinutes?: number;
  weather?: "sunny" | "cloudy" | "rain";
  mode?: "M" | "A" | "S";
  /** Estudio: esquema de luces con el que arranca (id de PRESETS) o null para empezar sin luces armadas. */
  studioPreset?: string;
}

export interface Lesson {
  id: string;
  level: CourseLevel;
  /** Número dentro del nivel (1…10). */
  number: number;
  title: string;
  /** Una línea para la lista. */
  summary: string;
  /** Explicación (párrafos cortos). */
  explanation: string[];
  /** Consejo práctico para la tarea. */
  tip: string;
  simulator: CourseSimulator;
  setup: LessonSetup;
  /** La consigna en una o dos oraciones. */
  task: string;
  criteria: LessonCriterion[];
}

export interface CriterionResult {
  label: string;
  required: boolean;
  ok: boolean;
  /** Qué faltó, en palabras simples (vacío si salió bien). */
  hint: string;
}

export interface GradeResult {
  passed: boolean;
  /** 0 si no aprobó; 1 a 3 según los requisitos opcionales cumplidos. */
  stars: number;
  results: CriterionResult[];
}
