import { FOCUS_POINT_DEFAULT_INDEX } from "./focus-math";
import type { CameraDerivedValues } from "./camera-types";
import type { ViewfinderMode } from "./camera-exposure";
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
  sceneLuminanceEv: number;
  setSceneLuminanceEv: (ev: number) => void;
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
  sceneLuminanceEv: 0,
  setSceneLuminanceEv: () => {},
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
