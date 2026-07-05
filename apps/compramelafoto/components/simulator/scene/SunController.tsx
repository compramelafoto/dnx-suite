"use client";

import { resolveHdriSceneConfig, resolveHdriSlotFromMinutes } from "@/lib/simulator/assets";
import { sunPositionFromState } from "@/lib/simulator/natural-light";
import { isPhotographicScene } from "@/lib/simulator/scenes";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * Sol direccional. En Ciudad Fotográfica solo sol + sombras (IBL vía HDRI).
 * Escenas legacy incluyen relleno ambiente/hemisférico.
 */
export default function SunController() {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const sun = simulatorRuntime.sunState;
    const photographic = isPhotographicScene(simulatorRuntime.sceneId);
    const [sx, sy, sz] = sunPositionFromState(sun);

    if (sunRef.current) {
      sunRef.current.position.set(sx, Math.max(sy, 0.5), sz);
      if (photographic) {
        const slot = resolveHdriSlotFromMinutes(simulatorRuntime.timeOfDayMinutes);
        const hdriCfg = resolveHdriSceneConfig(slot);
        sunRef.current.intensity = sun.sunIntensity * hdriCfg.sunIntensityScale;
        sunRef.current.color.set(hdriCfg.sunColorOverride ?? sun.sunColor);
      } else {
        sunRef.current.intensity = sun.sunIntensity;
        sunRef.current.color.set(sun.sunColor);
      }
      sunRef.current.visible = sun.sunVisible || sun.sunIntensity > 0.05;
      sunRef.current.target.position.copy(targetRef.current);
      sunRef.current.target.updateMatrixWorld();
    }

    if (!photographic) {
      if (ambRef.current) {
        ambRef.current.intensity = sun.ambientIntensity * 0.35;
        ambRef.current.color.set(sun.fogColor);
      }

      if (hemiRef.current) {
        hemiRef.current.intensity = sun.ambientIntensity;
        hemiRef.current.color.set(sun.skyColor);
        hemiRef.current.groundColor.set("#3a3a42");
      }
    } else {
      if (ambRef.current) ambRef.current.intensity = 0;
      if (hemiRef.current) hemiRef.current.intensity = 0;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemiRef} args={["#87b8e8", "#3a3a42", 0.6]} />
      <ambientLight ref={ambRef} intensity={0.25} />
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
    </>
  );
}
