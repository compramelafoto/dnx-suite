"use client";

import { focalLengthToFov } from "@/lib/simulator/camera-math";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { canvasSensorHeightMm } from "@/lib/simulator/viewfinder-frame";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * Sincroniza FOV vertical de la cámara 3D con la distancia focal activa, de
 * modo que el recuadro de captura (3:2) vea lo mismo que un full frame.
 */
export default function CameraFovSync() {
  const { camera, size } = useThree();
  const lastKeyRef = useRef("");

  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const focal = simulatorRuntime.focalLengthMm;
    const key = `${focal}:${size.width}x${size.height}`;
    if (key === lastKeyRef.current) return;

    const nextFov = focalLengthToFov(focal, canvasSensorHeightMm(size.width, size.height));
    if (Math.abs(camera.fov - nextFov) > 0.05) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
    lastKeyRef.current = key;
  });

  return null;
}
