"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useLayoutEffect, useEffect } from "react";

/** Sincroniza el store de cámara con el runtime compartido del canvas 3D. */
export default function SimulatorRuntimeSync() {
  const {
    derived,
    setSceneLuminanceEv,
    focus,
    settings,
    lens,
    viewfinderMode,
    sceneLuminanceEv,
    sceneId,
    timeOfDayMinutes,
    sunState,
  } = useCameraStore();

  useLayoutEffect(() => {
    simulatorRuntime.derived = derived;
    simulatorRuntime.viewfinderMode = viewfinderMode;
    simulatorRuntime.sceneId = sceneId;
    simulatorRuntime.timeOfDayMinutes = timeOfDayMinutes;
    simulatorRuntime.sunState = sunState;
    simulatorRuntime.sceneLuminanceEv = sceneLuminanceEv;
    simulatorRuntime.setSceneLuminanceEv = setSceneLuminanceEv;
    simulatorRuntime.focusDistanceM = focus.distanceM;
    simulatorRuntime.focusMode = focus.focusMode;
    simulatorRuntime.focusAreaMode = focus.focusAreaMode;
    simulatorRuntime.activeFocusPointIndex = focus.activeFocusPointIndex;
    simulatorRuntime.continuousFocusActive = focus.continuousFocusActive;
    simulatorRuntime.focusedObjectId = focus.focusedObjectId;
    simulatorRuntime.focalLengthMm = settings.focalLengthMm;
    simulatorRuntime.lensName = lens.lensName;
    simulatorRuntime.isZoomLens = lens.isZoomLens;
  }, [
    derived,
    viewfinderMode,
    sceneLuminanceEv,
    sceneId,
    timeOfDayMinutes,
    sunState,
    setSceneLuminanceEv,
    focus.distanceM,
    focus.focusMode,
    focus.focusAreaMode,
    focus.activeFocusPointIndex,
    focus.continuousFocusActive,
    focus.focusedObjectId,
    settings.focalLengthMm,
    lens.lensName,
    lens.isZoomLens,
  ]);

  useEffect(() => {
    return () => {
      simulatorRuntime.derived = null;
      simulatorRuntime.setSceneLuminanceEv = () => {};
    };
  }, []);

  return null;
}
