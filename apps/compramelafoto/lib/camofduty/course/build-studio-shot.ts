/** Arma la toma del Estudio que corrige el curso, con el fotómetro del set. */

import { activeLights, meter } from "@/lib/simulator/studio-light/metering";
import type { StudioState } from "@/lib/simulator/studio-light/types";
import type { StudioShot } from "./types";

export function buildStudioShot(state: StudioState): StudioShot {
  const report = meter(state);
  const active = activeLights(state);
  const key = active.find((l) => l.id === report.keyId) ?? null;
  return {
    sim: "estudio",
    iso: state.camera.iso,
    shutterSeconds: state.camera.shutter,
    aperture: state.camera.aperture,
    focalLengthMm: state.camera.focalMm,
    whiteBalance: state.camera.whiteBalance,
    exposureError: Number.isFinite(report.totalEv) ? report.totalEv : -10,
    pattern: report.pattern,
    ratio: report.ratio,
    side: report.side,
    backgroundEv: Number.isFinite(report.backgroundEv) ? report.backgroundEv : null,
    overSync: report.overSync,
    lightsOn: active.length,
    keyModifier: key?.modifier ?? null,
    hasHairLight: active.some((l) => l.aim === "hair"),
    hasBackgroundLight: active.some((l) => l.aim === "background"),
    subjectYaw: state.subjectYaw,
  };
}
