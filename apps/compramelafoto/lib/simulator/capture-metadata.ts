import type { CameraState } from "./camera-types";
import type { ExposureVerdict } from "./camera-types";
import type {
  CaptureFocusSnapshot,
  CaptureResult,
  CaptureUserInfo,
  ViewfinderMode,
} from "./camera-exposure";

export const SIMULATOR_SCENE_ID = "studio";
export const SIMULATOR_CAPTURE_RETENTION_DAYS = 7;

export type { CaptureUserInfo, CaptureFocusSnapshot } from "./camera-exposure";

/** Metadatos persistidos en DB y embebidos en EXIF UserComment. */
export interface SimulatorCaptureMetadata {
  settings: CameraState;
  measuredEv: number;
  verdict: ExposureVerdict;
  evLabel: string;
  pedagogyNotes?: string[];
  panningMatch?: number;
  focus?: CaptureFocusSnapshot;
  viewfinderMode?: ViewfinderMode;
  sceneId: string;
  sceneLuminanceEv: number;
  localClientId?: number;
}

export function buildCaptureMetadata(photo: CaptureResult): SimulatorCaptureMetadata {
  return {
    settings: photo.settings,
    measuredEv: photo.measuredEv,
    verdict: photo.verdict,
    evLabel: photo.evLabel,
    pedagogyNotes: photo.pedagogyNotes,
    panningMatch: photo.panningMatch,
    focus: photo.focus,
    viewfinderMode: photo.viewfinderMode,
    sceneId: photo.sceneId ?? SIMULATOR_SCENE_ID,
    sceneLuminanceEv: photo.sceneLuminanceEv ?? 0,
    localClientId: photo.id,
  };
}

export function formatCaptureDateTime(timestamp: number): { date: string; time: string } {
  const d = new Date(timestamp);
  return {
    date: d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

export function captureDisplayName(user: CaptureUserInfo | undefined): string {
  if (!user) return "Sin sesión";
  return user.name?.trim() || user.email;
}
