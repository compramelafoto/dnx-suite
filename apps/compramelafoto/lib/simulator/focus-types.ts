/** Modo de enfoque (store interno). UI: AF-S, AF-C, MF. */
export type FocusMode = "AF_S" | "AF_C" | "MF";

export type FocusAreaMode = "POINT" | "ZONE" | "WIDE";

export type FocusStatus = "IDLE" | "SEARCHING" | "FOCUS_OK" | "NO_FOCUS" | "TRACKING";

export interface FocusState {
  focusMode: FocusMode;
  focusAreaMode: FocusAreaMode;
  activeFocusPointIndex: number;
  distanceM: number;
  focusLocked: boolean;
  focusedObjectId: string | null;
  focusTargetWorldPosition: [number, number, number] | null;
  isFocusing: boolean;
  focusConfidence: number;
  continuousFocusActive: boolean;
  status: FocusStatus;
  targetLabel: string;
  lockedAtMs: number | null;
  /** Toast breve al cambiar área con V. */
  areaFeedback: string | null;
}

export const DEFAULT_FOCUS_STATE: FocusState = {
  focusMode: "AF_S",
  focusAreaMode: "POINT",
  activeFocusPointIndex: 7,
  distanceM: 6.5,
  focusLocked: false,
  focusedObjectId: null,
  focusTargetWorldPosition: null,
  isFocusing: false,
  focusConfidence: 0,
  continuousFocusActive: false,
  status: "IDLE",
  targetLabel: "Centro",
  lockedAtMs: null,
  areaFeedback: null,
};

export function focusModeToLabel(mode: FocusMode): string {
  switch (mode) {
    case "AF_S":
      return "AF-S";
    case "AF_C":
      return "AF-C";
    case "MF":
      return "MF";
  }
}

export function focusStatusToLabel(status: FocusStatus): string {
  switch (status) {
    case "SEARCHING":
      return "BUSCANDO";
    case "FOCUS_OK":
      return "FOCO OK";
    case "NO_FOCUS":
      return "SIN FOCO";
    case "TRACKING":
      return "SEGUIMIENTO";
    default:
      return "";
  }
}
