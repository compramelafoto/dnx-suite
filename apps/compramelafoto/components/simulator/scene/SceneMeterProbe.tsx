"use client";

import { MID_GREY } from "@/lib/simulator/metering";
import { sceneBrightnessEv100 } from "@/lib/simulator/scene-light";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame } from "@react-three/fiber";

const MID_GREY_LOG2 = Math.log2(MID_GREY);

/**
 * Fotómetro TTL: combina la luz absoluta de la escena (hora y lugar) con lo
 * que DepthOfFieldPass lee en la imagen del recuadro. Mientras dura la toma,
 * la exposición queda bloqueada como en la cámara.
 */
export default function SceneMeterProbe() {
  useFrame(() => {
    if (simulatorRuntime.captureActive) return;

    const brightnessEv100 = sceneBrightnessEv100(
      simulatorRuntime.sceneId,
      simulatorRuntime.timeOfDayMinutes,
    );
    const readings = simulatorRuntime.meterReadings;
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
