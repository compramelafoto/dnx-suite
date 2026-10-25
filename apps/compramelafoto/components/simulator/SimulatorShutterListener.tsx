"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import { COD_CAPTURE_FRAME_EVENT, COD_SHOT_TAKEN_EVENT, type CodCaptureFrameDetail, type CodShotTakenDetail } from "@/lib/simulator/capture-events";
import { playShutterSound, preloadShutterSamples, COD_OBTURAR_EVENT, type CodObturarDetail } from "@/lib/simulator/shutter-sound";
import { shutterSpeedToSeconds } from "@/lib/simulator/camera-math";
import { unlockSimulatorAudioFromGesture } from "@/lib/simulator/sound-engine";
import { useCallback, useEffect } from "react";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";

/**
 * Espacio → obturar, sonido y captura con acumulación en exposiciones largas.
 */
export default function SimulatorShutterListener() {
  const { settings, derived, focus, capturePhoto } = useCameraStore();

  const obturate = useCallback(() => {
    // Desde afuera no se saca la foto: hay que volver a la cámara.
    if (simulatorRuntime.thirdPerson) return;
    const effectiveShutter = derived.effectiveSettings.shutterSpeed;
    const durationMs = Math.max(shutterSpeedToSeconds(effectiveShutter) * 1000, 32);
    unlockSimulatorAudioFromGesture();
    playShutterSound(durationMs);
    const result = capturePhoto();
    window.dispatchEvent(new CustomEvent<CodShotTakenDetail>(COD_SHOT_TAKEN_EVENT, { detail: { result } }));
    window.dispatchEvent(
      new CustomEvent<CodCaptureFrameDetail>(COD_CAPTURE_FRAME_EVENT, {
        detail: {
          shutterSpeed: effectiveShutter,
          aperture: derived.effectiveSettings.aperture,
          focusDistanceM: focus.distanceM,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent<CodObturarDetail>(COD_OBTURAR_EVENT, { detail: { durationMs } }),
    );
  }, [derived.effectiveSettings.shutterSpeed, derived.effectiveSettings.aperture, focus.distanceM, capturePhoto]);

  // La grabación del obturador se baja con el primer gesto (antes no hay audio).
  useEffect(() => {
    const load = () => void preloadShutterSamples();
    window.addEventListener("pointerdown", load, { once: true });
    window.addEventListener("keydown", load, { once: true });
    return () => {
      window.removeEventListener("pointerdown", load);
      window.removeEventListener("keydown", load);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      event.preventDefault();
      obturate();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [obturate]);

  return null;
}
