"use client";

import { getSimulatorSpawnPose } from "@/components/simulator/scene/simulator-camera-constants";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/**
 * Fija la orientación inicial de la cámara al cargar la escena.
 */
export default function CameraSpawn() {
  const { camera } = useThree();

  useEffect(() => {
    const spawn = getSimulatorSpawnPose();
    camera.position.set(...spawn.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(...spawn.lookAt);
    camera.updateMatrixWorld();
  }, [camera]);

  return null;
}
