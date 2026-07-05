"use client";

import { focalLengthToFov } from "@/lib/simulator/camera-math";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/** Sincroniza FOV vertical de la cámara 3D con la distancia focal activa. */
export default function CameraFovSync() {
  const { camera } = useThree();
  const lastFocalRef = useRef(-1);

  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const focal = simulatorRuntime.focalLengthMm;
    if (focal === lastFocalRef.current) return;

    const nextFov = focalLengthToFov(focal);
    if (Math.abs(camera.fov - nextFov) > 0.05) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
    lastFocalRef.current = focal;
  });

  return null;
}
