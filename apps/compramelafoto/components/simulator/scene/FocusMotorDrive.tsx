"use client";

import {
  COD_FOCUS_PROGRESS_EVENT,
  COD_FOCUS_TARGET_EVENT,
  COD_FOCUS_UPDATED_EVENT,
  type CodFocusProgressDetail,
  type CodFocusTargetDetail,
  type CodFocusUpdatedDetail,
} from "@/lib/simulator/focus-events";
import type { FocusStatus } from "@/lib/simulator/focus-types";
import {
  focusMotorDurationMs,
  interpolateFocusDistance,
} from "@/lib/simulator/focus-motor";
import {
  FOCUS_CONFIRM_MIN_CONFIDENCE,
  playFocusConfirmSound,
  playFocusMotorSound,
} from "@/lib/simulator/focus-sound";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";

interface ActiveFocusDrive {
  fromM: number;
  toM: number;
  durationMs: number;
  elapsedMs: number;
  targetLabel: string;
  worldPoint: [number, number, number] | null;
  focusConfidence: number;
  focusedObjectId: string | null;
}

function roundDistanceM(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Anima el plano de enfoque (motor AF-S) y actualiza DOF en tiempo real.
 */
export default function FocusMotorDrive() {
  const driveRef = useRef<ActiveFocusDrive | null>(null);

  useEffect(() => {
    const onFocusTarget = (event: Event) => {
      const detail = (event as CustomEvent<CodFocusTargetDetail>).detail;
      const fromM = simulatorRuntime.focusDistanceM;
      const toM = detail.distanceM;
      const durationMs = focusMotorDurationMs(fromM, toM);

      driveRef.current = {
        fromM,
        toM,
        durationMs,
        elapsedMs: 0,
        targetLabel: detail.targetLabel,
        worldPoint: detail.worldPoint,
        focusConfidence: detail.focusConfidence,
        focusedObjectId: detail.focusedObjectId,
      };

      if (simulatorRuntime.focusMode !== "MF") {
        playFocusMotorSound(durationMs / 1000);
      }

      simulatorRuntime.focusedObjectId = detail.focusedObjectId;
    };

    window.addEventListener(COD_FOCUS_TARGET_EVENT, onFocusTarget);
    return () => window.removeEventListener(COD_FOCUS_TARGET_EVENT, onFocusTarget);
  }, []);

  useFrame((_, delta) => {
    const drive = driveRef.current;
    if (!drive) return;

    drive.elapsedMs += delta * 1000;
    const progress = Math.min(1, drive.elapsedMs / drive.durationMs);
    const currentM = interpolateFocusDistance(drive.fromM, drive.toM, progress);
    const rounded = roundDistanceM(currentM);

    simulatorRuntime.focusDistanceM = currentM;

    window.dispatchEvent(
      new CustomEvent<CodFocusProgressDetail>(COD_FOCUS_PROGRESS_EVENT, {
        detail: { distanceM: rounded },
      }),
    );

    if (progress < 1) return;

    const payload: CodFocusUpdatedDetail = {
      distanceM: drive.toM,
      targetLabel: drive.targetLabel,
      worldPoint: drive.worldPoint,
      focusConfidence: drive.focusConfidence,
      focusedObjectId: drive.focusedObjectId,
      status: (drive.focusConfidence >= 0.4 ? "FOCUS_OK" : "NO_FOCUS") as FocusStatus,
      focusLocked: simulatorRuntime.focusMode === "AF_S",
    };

    simulatorRuntime.focusDistanceM = drive.toM;
    driveRef.current = null;

    const focusOk = drive.focusConfidence >= FOCUS_CONFIRM_MIN_CONFIDENCE;
    const mode = simulatorRuntime.focusMode;
    if (mode !== "MF" && focusOk) {
      playFocusConfirmSound(drive.focusConfidence);
    }

    window.dispatchEvent(
      new CustomEvent<CodFocusUpdatedDetail>(COD_FOCUS_UPDATED_EVENT, { detail: payload }),
    );
  });

  return null;
}
