import type { FocusAreaMode, FocusStatus } from "./focus-types";

export const COD_FOCUS_REQUEST_EVENT = "cod-focus-request";

export interface CodFocusRequestDetail {
  source: "center" | "click" | "keyboard" | "continuous";
  ndc?: [number, number];
  focusAreaMode?: FocusAreaMode;
  activeFocusPointIndex?: number;
}

export const COD_FOCUS_TARGET_EVENT = "cod-focus-target";

export interface CodFocusTargetDetail {
  distanceM: number;
  targetLabel: string;
  worldPoint: [number, number, number] | null;
  focusConfidence: number;
  focusedObjectId: string | null;
}

export const COD_FOCUS_PROGRESS_EVENT = "cod-focus-progress";

export interface CodFocusProgressDetail {
  distanceM: number;
}

/** Actualización continua AF-C sin reiniciar el motor. */
export const COD_FOCUS_TRACKING_EVENT = "cod-focus-tracking";

export interface CodFocusTrackingDetail {
  distanceM: number;
  worldPoint: [number, number, number];
  focusConfidence: number;
  focusedObjectId: string | null;
}

export const COD_FOCUS_UPDATED_EVENT = "cod-focus-updated";

export interface CodFocusUpdatedDetail {
  distanceM: number;
  targetLabel: string;
  worldPoint: [number, number, number] | null;
  focusConfidence: number;
  focusedObjectId: string | null;
  status: FocusStatus;
  focusLocked: boolean;
}
