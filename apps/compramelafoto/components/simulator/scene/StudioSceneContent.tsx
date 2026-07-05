"use client";

import { Environment } from "@react-three/drei";
import { Suspense } from "react";
import TrainingRoomScene from "./TrainingRoomScene";

/** Estudio con ambiente interior (IBL warehouse). */
export default function StudioSceneContent() {
  return (
    <>
      <color attach="background" args={["#1a1a22"]} />
      <fog attach="fog" args={["#1a1a22", 30, 70]} />
      <Suspense fallback={null}>
        <Environment preset="warehouse" environmentIntensity={0.4} />
      </Suspense>
      <TrainingRoomScene />
    </>
  );
}
