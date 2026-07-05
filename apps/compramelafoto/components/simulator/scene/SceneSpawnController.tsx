"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import { getSimulatorSpawnPose } from "@/components/simulator/scene/simulator-camera-constants";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/**
 * Reposiciona la cámara al cambiar de escena.
 */
export default function SceneSpawnController() {
  const { sceneId } = useCameraStore();
  const { camera } = useThree();

  useEffect(() => {
    const spawn = getSimulatorSpawnPose(sceneId);
    camera.position.set(...spawn.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(...spawn.lookAt);
    camera.updateMatrixWorld();
  }, [camera, sceneId]);

  return null;
}
