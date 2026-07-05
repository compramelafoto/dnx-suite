"use client";

import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { estimateSceneLuminanceEv } from "@/lib/simulator/camera-exposure";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * Estima luminancia de escena según posición de cámara (medición simplificada).
 *
 * TODO (etapas futuras):
 * - Medición puntual al centro del visor
 * - Medición matricial
 */
export default function SceneMeterProbe() {
  const { camera } = useThree();

  useFrame(() => {
    const ev = estimateSceneLuminanceEv(camera.position.x, camera.position.z);
    simulatorRuntime.sceneLuminanceEv = ev;
    simulatorRuntime.setSceneLuminanceEv(ev);
  });

  return null;
}
