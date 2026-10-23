"use client";

import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import {
  buildStreetLayout,
  resolveStreetCollision,
  streetGroundHeight,
} from "@/lib/simulator/street/street-layout";
import { useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import StreetBuildings from "./StreetBuildings";
import StreetGround from "./StreetGround";
import StreetLighting from "./StreetLighting";
import StreetPedestrians from "./StreetPedestrians";
import StreetProps from "./StreetProps";

/**
 * Calle 3D: una esquina de barrio con edificios, veredas, mobiliario, luz por
 * hora y peatones caminando.
 */
export default function StreetScene() {
  const layout = useMemo(() => buildStreetLayout(), []);
  const camera = useThree((s) => s.camera);

  // Sólo en desarrollo: mover la cámara desde la consola o Playwright.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    (globalThis as Record<string, unknown>).__codCamera = camera;
  }, [camera]);

  useEffect(() => {
    simulatorRuntime.walkableWorld = {
      resolve: (x, z) => resolveStreetCollision(x, z, layout.colliders),
      groundHeight: streetGroundHeight,
    };
    return () => {
      simulatorRuntime.walkableWorld = null;
    };
  }, [layout]);

  return (
    <group>
      <StreetLighting />
      <Suspense fallback={null}>
        <StreetGround />
      </Suspense>
      <Suspense fallback={null}>
        <StreetBuildings layout={layout} />
      </Suspense>
      <Suspense fallback={null}>
        <StreetProps layout={layout} />
      </Suspense>
      <Suspense fallback={null}>
        <StreetPedestrians layout={layout} />
      </Suspense>
    </group>
  );
}
