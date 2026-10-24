"use client";

import { MID_GREY } from "@/lib/simulator/metering";
import { sceneBrightnessEv100 } from "@/lib/simulator/scene-light";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

const MID_GREY_LOG2 = Math.log2(MID_GREY);

/**
 * Fotómetro TTL: combina la luz absoluta de la escena (hora y lugar) con lo
 * que DepthOfFieldPass lee en la imagen del recuadro. Mientras dura la toma,
 * la exposición queda bloqueada como en la cámara.
 */
export default function SceneMeterProbe() {
  // Sólo se avisa al panel cuando hay algo nuevo: una lectura del fotómetro (cada
  // ~120 ms), otra hora u otro modo. Hacerlo en cada cuadro rearmaba la interfaz.
  const last = useRef<{ readings: unknown; minutes: number; mode: string } | null>(null);
  useFrame(() => {
    if (simulatorRuntime.captureActive) return;

    const readings = simulatorRuntime.meterReadings;
    const seen = last.current;
    if (seen && seen.readings === readings && seen.minutes === simulatorRuntime.timeOfDayMinutes && seen.mode === simulatorRuntime.meteringMode) return;
    last.current = { readings, minutes: simulatorRuntime.timeOfDayMinutes, mode: simulatorRuntime.meteringMode };

    const brightnessEv100 = sceneBrightnessEv100(
      simulatorRuntime.sceneId,
      simulatorRuntime.timeOfDayMinutes,
    );
    const offset = (log2: number | undefined) =>
      log2 == null ? 0 : log2 - MID_GREY_LOG2;

    simulatorRuntime.setSceneLight({
      brightnessEv100,
      meteredEv100: brightnessEv100 + offset(readings?.[simulatorRuntime.meteringMode]),
      eyeEv100: brightnessEv100 + offset(readings?.MATRIX),
    });
  });

  return null;
}
