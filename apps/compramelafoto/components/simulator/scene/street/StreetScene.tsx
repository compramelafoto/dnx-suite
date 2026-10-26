"use client";

import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import {
  buildStreetLayout,
  resolveStreetCollision,
  streetGroundHeight,
} from "@/lib/simulator/street/street-layout";
import { useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import StreetBuildings from "./StreetBuildings";
import StreetDecals from "./StreetDecals";
import StreetGround from "./StreetGround";
import StreetLighting from "./StreetLighting";
import StreetNeonBar from "./StreetNeonBar";
import StreetPedestrians from "./StreetPedestrians";
import StreetPlaza from "./StreetPlaza";
import StreetProps from "./StreetProps";
import StreetTraffic from "./StreetTraffic";
import StreetRain from "./StreetRain";
import StreetFlashes from "./StreetFlashes";
import ThirdPersonView from "./ThirdPersonView";
import { LoadingHold } from "../SceneLoadingGate";

/**
 * Calle 3D: un barrio de 3 × 3 manzanas con plaza, casas, centro y pasajes;
 * edificios, veredas, mobiliario, detalles en el piso, luz por hora, tránsito
 * y peatones caminando.
 */
export default function StreetScene() {
  const layout = useMemo(() => buildStreetLayout(), []);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  // Sólo en desarrollo: mover la cámara y medir el render desde la consola o Playwright.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    (globalThis as Record<string, unknown>).__codCamera = camera;
    (globalThis as Record<string, unknown>).__codGl = gl;
    (globalThis as Record<string, unknown>).__codScene = scene;
    (globalThis as Record<string, unknown>).__codTHREE = THREE;
  }, [camera, gl, scene]);

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
      <StreetRain />
      <StreetFlashes />
      <ThirdPersonView />
      <Suspense fallback={<LoadingHold />}>
        <StreetGround layout={layout} />
      </Suspense>
      <StreetPlaza plaza={layout.plaza} />
      {layout.neonBar ? <StreetNeonBar bar={layout.neonBar} /> : null}
      <StreetDecals layout={layout} />
      <Suspense fallback={<LoadingHold />}>
        <StreetBuildings layout={layout} />
      </Suspense>
      <Suspense fallback={<LoadingHold />}>
        <StreetProps layout={layout} />
      </Suspense>
      <Suspense fallback={<LoadingHold />}>
        <StreetPedestrians layout={layout} />
      </Suspense>
      <Suspense fallback={<LoadingHold />}>
        <StreetTraffic />
      </Suspense>
    </group>
  );
}
