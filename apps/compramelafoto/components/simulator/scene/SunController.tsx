"use client";

import { resolveHdriSceneConfig, resolveHdriSlotFromMinutes } from "@/lib/simulator/assets";
import { sunPositionFromState } from "@/lib/simulator/natural-light";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * Sol direccional de Ciudad Fotográfica: solo sol + sombras (IBL vía HDRI),
 * sin relleno ambiente ni hemisférico.
 */
export default function SunController() {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const sun = simulatorRuntime.sunState;
    const [sx, sy, sz] = sunPositionFromState(sun);

    if (sunRef.current) {
      sunRef.current.position.set(sx, Math.max(sy, 0.5), sz);
      const slot = resolveHdriSlotFromMinutes(simulatorRuntime.timeOfDayMinutes);
      const hdriCfg = resolveHdriSceneConfig(slot);
      sunRef.current.intensity = sun.sunIntensity * hdriCfg.sunIntensityScale;
      sunRef.current.color.set(hdriCfg.sunColorOverride ?? sun.sunColor);
      sunRef.current.visible = sun.sunVisible || sun.sunIntensity > 0.05;
      sunRef.current.target.position.copy(targetRef.current);
      sunRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <directionalLight
      ref={sunRef}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-far={90}
      shadow-camera-left={-28}
      shadow-camera-right={28}
      shadow-camera-top={28}
      shadow-camera-bottom={-28}
      shadow-bias={-0.00025}
      shadow-normalBias={0.02}
    />
  );
}
