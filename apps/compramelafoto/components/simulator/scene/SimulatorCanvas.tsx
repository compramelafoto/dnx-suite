"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import ViewportSizeSync from "./ViewportSizeSync";
import CameraFovSync from "./CameraFovSync";
import CameraVisualEffect from "./CameraVisualEffect";
import CanvasPhotoCapture from "./CanvasPhotoCapture";
import DevDebugScene from "./DevDebugScene";
import DepthOfFieldPass from "./DepthOfFieldPass";
import FocusContinuousDrive from "./FocusContinuousDrive";
import FocusMotorDrive from "./FocusMotorDrive";
import FocusRaycaster from "./FocusRaycaster";
import FirstPersonController from "./FirstPersonController";
import SceneMeterProbe from "./SceneMeterProbe";
import SceneSpawnController from "./SceneSpawnController";
import SimulatorSceneHealthCheck from "./SimulatorSceneHealthCheck";
import SimulatorSceneRoot from "./SimulatorSceneRoot";
import { SCENE_RENDER_CALIBRATION } from "@/lib/simulator/camera-exposure";
import { resolveRenderProfile } from "@/lib/simulator/render";
import { resolveThreeToneMapping } from "@/lib/simulator/render/render-profile";
import { focalLengthToFov } from "@/lib/simulator/camera-math";
import { EYE_HEIGHT } from "./simulator-camera-constants";

export interface SimulatorCanvasProps {
  onLockChange?: (locked: boolean) => void;
  onLoaded?: () => void;
}

export default function SimulatorCanvas({ onLockChange, onLoaded }: SimulatorCanvasProps) {
  const devDebugScene = process.env.NEXT_PUBLIC_COD_DEV_DEBUG_SCENE === "true";

  return (
    <Canvas
      className="cod-sim__canvas"
      shadows
      dpr={[1, 1.5]}
      frameloop="always"
      resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
      camera={{
        fov: focalLengthToFov(50),
        near: 0.15,
        far: 120,
        position: [0, EYE_HEIGHT, 7],
      }}
      onCreated={({ gl, scene, camera }) => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        const defaultProfile = resolveRenderProfile("studio");
        gl.toneMapping = resolveThreeToneMapping(defaultProfile.toneMapping);
        gl.toneMappingExposure = SCENE_RENDER_CALIBRATION;
        gl.setClearColor("#1a1a22", 1);
        gl.setClearAlpha(1);

        if (process.env.NODE_ENV === "development") {
          console.info("[Cam Of Duty] Canvas mounted", {
            buffer: { w: gl.domElement.width, h: gl.domElement.height },
            camera: camera.position.toArray(),
            sceneChildren: scene.children.length,
          });
        }
      }}
      gl={{
        alpha: false,
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      }}
    >
      {devDebugScene ? <color attach="background" args={["#b8bcc8"]} /> : null}

      <ViewportSizeSync />
      <CameraFovSync />
      <SceneSpawnController />
      {devDebugScene ? <DevDebugScene /> : <SimulatorSceneRoot />}
      <CameraVisualEffect />
      <SceneMeterProbe />
      <CanvasPhotoCapture />
      <DepthOfFieldPass />
      <SimulatorSceneHealthCheck onReady={onLoaded} />
      <FocusRaycaster />
      <FocusMotorDrive />
      <FocusContinuousDrive />
      <FirstPersonController onLockChange={onLockChange} />
    </Canvas>
  );
}
