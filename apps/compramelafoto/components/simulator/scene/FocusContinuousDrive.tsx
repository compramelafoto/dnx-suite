"use client";

import { findMovingSubject } from "@/lib/simulator/moving-subject-types";
import {
  COD_FOCUS_PROGRESS_EVENT,
  COD_FOCUS_TRACKING_EVENT,
  type CodFocusProgressDetail,
  type CodFocusTrackingDetail,
} from "@/lib/simulator/focus-events";
import { roundFocusDistanceM } from "@/lib/simulator/focus-math";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

const TRACK_INTERVAL_MS = 80;
const TRACK_DISTANCE_EPS = 0.08;

/**
 * Seguimiento AF-C mientras C está presionada y hay sujeto enfocado.
 */
export default function FocusContinuousDrive() {
  const { camera } = useThree();
  const lastTrackMs = useRef(0);
  const lastDistance = useRef(simulatorRuntime.focusDistanceM);

  useFrame(() => {
    if (!simulatorRuntime.continuousFocusActive) return;
    if (simulatorRuntime.focusMode !== "AF_C") return;

    const focusedId = simulatorRuntime.focusedObjectId;
    const subject = findMovingSubject(simulatorRuntime.movingSubjects, focusedId);
    if (!subject?.visible) return;

    const now = performance.now();
    if (now - lastTrackMs.current < TRACK_INTERVAL_MS) return;
    lastTrackMs.current = now;

    const [sx, sy, sz] = subject.position;
    const targetM = roundFocusDistanceM(
      Math.hypot(sx - camera.position.x, sy - camera.position.y, sz - camera.position.z),
    );

    if (Math.abs(targetM - lastDistance.current) < TRACK_DISTANCE_EPS) return;
    lastDistance.current = targetM;

    simulatorRuntime.focusDistanceM = targetM;

    window.dispatchEvent(
      new CustomEvent<CodFocusProgressDetail>(COD_FOCUS_PROGRESS_EVENT, {
        detail: { distanceM: targetM },
      }),
    );

    window.dispatchEvent(
      new CustomEvent<CodFocusTrackingDetail>(COD_FOCUS_TRACKING_EVENT, {
        detail: {
          distanceM: targetM,
          worldPoint: subject.position,
          focusConfidence: 0.78,
          focusedObjectId: focusedId,
        },
      }),
    );
  });

  return null;
}
