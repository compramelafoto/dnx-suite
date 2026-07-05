"use client";

import { isExteriorScene } from "@/lib/simulator/scenes";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Sincroniza fondo, niebla y farolas según escena y hora.
 */
export default function SceneEnvironmentSync() {
  const { scene } = useThree();
  const streetLightsRef = useRef<THREE.PointLight[]>([]);

  useEffect(() => {
    streetLightsRef.current = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.PointLight && obj.userData.codStreetLight) {
        streetLightsRef.current.push(obj);
      }
    });
  }, [scene]);

  useFrame(() => {
    const sceneId = simulatorRuntime.sceneId;
    const sun = simulatorRuntime.sunState;

    if (!isExteriorScene(sceneId)) return;

    scene.background = new THREE.Color(sun.skyColor);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.set(sun.fogColor);
      scene.fog.near = sun.sunVisible ? 35 : 20;
      scene.fog.far = sun.sunVisible ? 95 : 65;
    }

    const night = !sun.sunVisible && sun.phaseLabel === "Noche";
    for (const light of streetLightsRef.current) {
      light.intensity = night ? 1.4 : sun.phaseLabel === "Hora azul" ? 0.5 : 0;
    }
  });

  return null;
}
