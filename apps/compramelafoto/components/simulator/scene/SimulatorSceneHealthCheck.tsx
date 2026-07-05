"use client";

import { SCENE_RENDER_CALIBRATION } from "@/lib/simulator/camera-exposure";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export interface SimulatorSceneHealthCheckProps {
  onReady?: () => void;
}

export default function SimulatorSceneHealthCheck({ onReady }: SimulatorSceneHealthCheckProps) {
  const { gl, scene, camera } = useThree();
  const reportedRef = useRef(false);
  const framesRef = useRef(0);

  useFrame(() => {
    if (reportedRef.current) return;
    framesRef.current += 1;
    if (framesRef.current < 4) return;

    reportedRef.current = true;

    let meshCount = 0;
    let lightCount = 0;
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshCount += 1;
      if (obj instanceof THREE.Light) lightCount += 1;
    });

    const canvas = gl.domElement;
    const css = canvas.getBoundingClientRect();
    const exposure = gl.toneMappingExposure;
    const preview = simulatorRuntime.derived?.previewExposureMultiplier ?? SCENE_RENDER_CALIBRATION;

    if (process.env.NODE_ENV === "development") {
      const layoutOk = meshCount > 0 && css.width > 32 && css.height > 32;
      const payload = {
        meshCount,
        lightCount,
        canvasBuffer: { w: canvas.width, h: canvas.height },
        canvasCss: { w: Math.round(css.width), h: Math.round(css.height) },
        toneMappingExposure: exposure,
        previewExposureMultiplier: preview,
        camera: camera.position.toArray(),
      };

      if (layoutOk) {
        console.info("[Cam Of Duty] Escena lista", payload);
      } else {
        console.warn("[Cam Of Duty] Escena con problemas de montaje", payload);
      }
    }

    onReady?.();
  });

  return null;
}
