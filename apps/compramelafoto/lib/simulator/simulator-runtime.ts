import { FOCUS_POINT_DEFAULT_INDEX } from "./focus-math";
import type { CameraDerivedValues } from "./camera-types";
import type { SceneLight, ViewfinderMode } from "./camera-exposure";
import type { MeteringMode, MeterReadings } from "./metering";
import type { FocusAreaMode, FocusMode } from "./focus-types";
import type { SunState } from "./natural-light";
import { computeSunState, DEFAULT_TIME_OF_DAY_MINUTES } from "./natural-light";
import type { MovingSubjectState } from "./moving-subject-types";
import type { SimulatorSceneId } from "./scenes";

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
  /** Distancia mínima de enfoque del objetivo montado (m). */
  minFocusDistanceM: number;
  getCameraYaw: () => number;
}

let cameraYawGetter: () => number = () => 0;

export const simulatorRuntime: SimulatorRuntime = {
  derived: null,
  captureActive: false,
  captureExposureGain: null,
  appliedToneMappingExposure: null,
  viewfinderMode: "dslr-view",
  sceneId: "studio",
  timeOfDayMinutes: DEFAULT_TIME_OF_DAY_MINUTES,
  sunState: computeSunState(DEFAULT_TIME_OF_DAY_MINUTES),
  sceneLight: null,
  setSceneLight: () => {},
  meteringMode: "MATRIX",
  meterReadings: null,
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
  getCameraYaw: () => cameraYawGetter(),
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
