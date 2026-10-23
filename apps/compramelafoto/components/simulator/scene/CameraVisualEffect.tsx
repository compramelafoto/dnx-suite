"use client";

import {
  clampRendererExposure,
  resolvePreviewExposureGain,
  SCENE_RENDER_CALIBRATION,
} from "@/lib/simulator/camera-exposure";
import { applyToneMappingToRenderer, usesPhotographicPipeline } from "@/lib/simulator/render";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const FOG_COLOR = "#1a1a22";

/**
 * Sincroniza toneMappingExposure antes del render DOF.
 * LIVE VIEW → exposición WYSIWYG + WB en shader.
 * DSLR VIEW → exposición fija tipo ojo humano; sin WB (visor óptico).
 */
export default function CameraVisualEffect() {
  const { gl, scene } = useThree();
  const lastLogMsRef = useRef(0);

  useFrame(() => {
    if (simulatorRuntime.captureActive) return;

    const exposureGain = resolvePreviewExposureGain();
    const exposure = clampRendererExposure(exposureGain * SCENE_RENDER_CALIBRATION);
    const sceneId = simulatorRuntime.sceneId;

    if (usesPhotographicPipeline(sceneId)) {
      applyToneMappingToRenderer(gl, sceneId, exposure);
    } else {
      gl.toneMapping = THREE.LinearToneMapping;
      gl.toneMappingExposure = exposure;
    }
    simulatorRuntime.appliedToneMappingExposure = exposure;

    // El balance de blancos lo aplica DepthOfFieldPass a toda la imagen;
    // teñir también la niebla la corregía dos veces.
    const fog = scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.set(FOG_COLOR);
    }

    if (process.env.NODE_ENV === "development") {
      const now = performance.now();
      if (now - lastLogMsRef.current > 4000) {
        lastLogMsRef.current = now;
        console.info("[Cam Of Duty] Exposure", {
          viewfinder: simulatorRuntime.viewfinderMode,
          exposureGain,
          toneMappingExposure: exposure,
          photoMultiplier: simulatorRuntime.derived?.photoExposureMultiplier,
          sceneLight: simulatorRuntime.sceneLight,
        });
      }
    }
  }, -1);

  return null;
}
