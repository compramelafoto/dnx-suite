import { FOCUS_POINT_DEFAULT_INDEX } from "./focus-math";
import type { CameraDerivedValues } from "./camera-types";
import type { SceneLight, ViewfinderMode } from "./camera-exposure";
import type { MeteringMode, MeterReadings } from "./metering";
import { QUALITY_TIERS, type QualityTier } from "./render-quality";
import type { FocusAreaMode, FocusMode } from "./focus-types";
import type { SunState } from "./natural-light";
import { computeSunState, DEFAULT_TIME_OF_DAY_MINUTES } from "./natural-light";
import type { MovingSubjectState } from "./moving-subject-types";
import { DEFAULT_SCENE_ID, type SimulatorSceneId } from "./scenes";

/**
 * Puente entre React Context (fuera del Canvas) y el loop R3F (dentro).
 */
export interface SimulatorRuntime {
  derived: CameraDerivedValues | null;
  captureActive: boolean;
  captureExposureGain: number | null;
  appliedToneMappingExposure: number | null;
  viewfinderMode: ViewfinderMode;
  sceneId: SimulatorSceneId;
  timeOfDayMinutes: number;
  sunState: SunState;
  /** Luz que usa la cámara (absoluta + medida), espejo del store. */
  sceneLight: SceneLight | null;
  setSceneLight: (light: SceneLight) => void;
  meteringMode: MeteringMode;
  /** Últimas lecturas del fotómetro sobre la imagen (log2 de luminancia del render). */
  meterReadings: MeterReadings | null;
  /** Grilla de luminancia del recuadro (lineal, de arriba hacia abajo): fotómetro e histograma. */
  meterGrid: { width: number; height: number; luminance: Float32Array } | null;
  movingSubject: MovingSubjectState | null;
  movingSubjects: MovingSubjectState[];
  focusDistanceM: number;
  focusMode: FocusMode;
  focusAreaMode: FocusAreaMode;
  activeFocusPointIndex: number;
  continuousFocusActive: boolean;
  focusedObjectId: string | null;
  focalLengthMm: number;
  lensName: string;
  isZoomLens: boolean;
  /** Calidad de render vigente (la ajusta QualityGovernor según la fluidez). */
  quality: QualityTier;
  /** Mundo caminable de la escena activa (colisiones y altura del piso), si tiene. */
  walkableWorld: {
    resolve: (x: number, z: number) => [number, number];
    groundHeight: (x: number, z: number) => number;
  } | null;
  /** Distancia mínima de enfoque del objetivo montado (m). */
  minFocusDistanceM: number;
  getCameraYaw: () => number;
  /** Charco visible más cercano (m) o null: lo usa el curso (lección de reflejos). */
  nearestPuddleM: number | null;
  /** Geometría de la toma (altura, inclinación, dónde quedó el sujeto en el cuadro), para el curso. */
  shotGeometry: (() => ShotGeometry) | null;
  /** Posición y hacia dónde mira la cámara (para poner flashes donde está el fotógrafo). */
  cameraPose: (() => { position: [number, number, number]; yawDeg: number; pitchDeg: number }) | null;
  /** Vista en tercera persona: no se camina ni se mira en primera persona, ni se obtura. */
  thirdPerson: boolean;
}

export interface ShotGeometry {
  /** Altura de la cámara sobre el piso (m). */
  cameraHeightM: number;
  /** Inclinación (grados, 0 = horizonte derecho). */
  rollDeg: number;
  /** Distancia y posición en el cuadro (0–1) del sujeto enfocado, si se ve. */
  subjectDistanceM: number | null;
  subjectFrameX: number | null;
  subjectFrameY: number | null;
}

let cameraYawGetter: () => number = () => 0;

export const simulatorRuntime: SimulatorRuntime = {
  derived: null,
  captureActive: false,
  captureExposureGain: null,
  appliedToneMappingExposure: null,
  viewfinderMode: "dslr-view",
  sceneId: DEFAULT_SCENE_ID,
  timeOfDayMinutes: DEFAULT_TIME_OF_DAY_MINUTES,
  sunState: computeSunState(DEFAULT_TIME_OF_DAY_MINUTES),
  sceneLight: null,
  setSceneLight: () => {},
  meteringMode: "MATRIX",
  meterReadings: null,
  meterGrid: null,
  movingSubject: null,
  movingSubjects: [],
  focusDistanceM: 6.5,
  focusMode: "AF_S",
  focusAreaMode: "POINT",
  activeFocusPointIndex: FOCUS_POINT_DEFAULT_INDEX,
  continuousFocusActive: false,
  focusedObjectId: null,
  focalLengthMm: 50,
  lensName: "50mm f/1.8",
  isZoomLens: false,
  minFocusDistanceM: 0.45,
  walkableWorld: null,
  quality: QUALITY_TIERS[1],
  getCameraYaw: () => cameraYawGetter(),
  nearestPuddleM: null,
  shotGeometry: null,
  cameraPose: null,
  thirdPerson: false,
};

export function registerSimulatorCameraYaw(getter: () => number) {
  cameraYawGetter = getter;
}

export function unregisterSimulatorCameraYaw() {
  cameraYawGetter = () => 0;
}

export function syncMovingSubjectsRegistry(subjects: MovingSubjectState[]): void {
  simulatorRuntime.movingSubjects = subjects;
  simulatorRuntime.movingSubject = subjects.find((s) => s.visible) ?? subjects[0] ?? null;
}
