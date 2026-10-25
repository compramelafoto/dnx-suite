"use client";

import StreetScene from "./street/StreetScene";

/**
 * Escena del simulador: la Calle 3D (única escena por ahora).
 */
export default function SimulatorSceneRoot() {
  return (
    <group key="photographic-city">
      <StreetScene />
    </group>
  );
}
