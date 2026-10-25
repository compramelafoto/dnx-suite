/**
 * Arma la toma que corrige el curso a partir de lo que pasó al obturar en la
 * calle: ajustes de cámara, exposición, qué quedó enfocado y cómo se movía.
 */

import type { CaptureResult } from "@/lib/simulator/camera-exposure";
import { shutterSpeedToSeconds } from "@/lib/simulator/camera-math";
import { STREET_CAR_ID_PREFIX, STREET_PERSON_ID_PREFIX, findMovingSubject } from "@/lib/simulator/moving-subject-types";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { weatherStore } from "@/lib/simulator/weather";
import type { ShotSubjectKind, StreetShot } from "./types";

/** Qué es lo enfocado, según su identificador. */
export function subjectKindOf(id: string | null): ShotSubjectKind {
  if (!id) return "ninguno";
  if (id.startsWith(STREET_PERSON_ID_PREFIX)) return id.slice(STREET_PERSON_ID_PREFIX.length).startsWith("run") ? "corredor" : "persona";
  if (id.startsWith(STREET_CAR_ID_PREFIX)) {
    const rest = id.slice(STREET_CAR_ID_PREFIX.length);
    if (rest.startsWith("bici")) return "bici";
    if (rest.startsWith("moto")) return "moto";
    return "auto";
  }
  return "ninguno";
}

export function buildStreetShot(result: CaptureResult): StreetShot {
  const s = result.settings;
  const geometry = simulatorRuntime.shotGeometry?.();
  const focusedId = simulatorRuntime.focusedObjectId;
  const subject = findMovingSubject(simulatorRuntime.movingSubjects, focusedId);
  const kind = subject ? subjectKindOf(focusedId) : "ninguno";
  const speed = subject ? (subject.velocity ? Math.hypot(subject.velocity[0], subject.velocity[2]) : Math.abs(subject.speed)) : 0;
  return {
    sim: "calle",
    iso: s.iso,
    shutterSeconds: shutterSpeedToSeconds(s.shutterSpeed),
    aperture: s.aperture,
    focalLengthMm: s.focalLengthMm,
    whiteBalance: s.whiteBalance,
    mode: s.mode,
    exposureCompensation: s.exposureCompensation,
    exposureError: result.measuredEv,
    metering: simulatorRuntime.meteringMode,
    focusMode: result.focus?.mode ?? "AF-S",
    focusDistanceM: result.focus?.distanceM ?? simulatorRuntime.focusDistanceM,
    subject: {
      kind,
      distanceM: kind === "ninguno" ? null : (geometry?.subjectDistanceM ?? null),
      speedMps: speed,
      frameX: kind === "ninguno" ? null : (geometry?.subjectFrameX ?? null),
      frameY: kind === "ninguno" ? null : (geometry?.subjectFrameY ?? null),
    },
    panningMatch: null,
    timeOfDayMinutes: simulatorRuntime.timeOfDayMinutes,
    sunElevationDeg: simulatorRuntime.sunState.elevationDeg,
    weather: weatherStore.get(),
    cameraHeightM: geometry?.cameraHeightM ?? 1.7,
    rollDeg: geometry?.rollDeg ?? 0,
    puddleDistanceM: simulatorRuntime.nearestPuddleM,
  };
}
