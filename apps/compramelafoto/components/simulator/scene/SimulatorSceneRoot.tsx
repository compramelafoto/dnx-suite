"use client";

import { isLegacyCityPrototype, isPhotographicScene } from "@/lib/simulator/scenes";
import { useCameraStore } from "@/lib/simulator/camera-store";
import { Environment } from "@react-three/drei";
import { Suspense } from "react";
import CityScene from "./CityScene";
import DynamicSky from "./DynamicSky";
import StreetScene from "./street/StreetScene";
import SceneEnvironmentSync from "./SceneEnvironmentSync";
import StudioSceneContent from "./StudioSceneContent";
import SunController from "./SunController";

function LegacyCityExteriorContent() {
  return (
    <>
      <DynamicSky />
      <SunController />
      <SceneEnvironmentSync />
      <fog attach="fog" args={["#a8c8e8", 35, 95]} />
      <Suspense fallback={null}>
        <Environment preset="city" environmentIntensity={0.25} />
      </Suspense>
      <CityScene />
    </>
  );
}

/**
 * Selector de escena activa (estudio | ciudad prototipo | calle 3D).
 */
export default function SimulatorSceneRoot() {
  const { sceneId } = useCameraStore();

  if (isPhotographicScene(sceneId)) {
    return (
      <group key="photographic-city">
        <StreetScene />
      </group>
    );
  }

  if (isLegacyCityPrototype(sceneId)) {
    return (
      <group key="city">
        <LegacyCityExteriorContent />
      </group>
    );
  }

  return (
    <group key="studio">
      <StudioSceneContent />
    </group>
  );
}
