"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SUBJECT_HEAD } from "@/lib/simulator/studio-light/metering";
import type { BustId } from "@/lib/simulator/studio-light/figures";

const MODEL_DIR = "/camofduty/models/head";
const MODEL_URL = `${MODEL_DIR}/LeePerrySmith.glb`;

/** El escaneo mide ~7,9 unidades de alto; lo llevamos a un busto real (~44 cm). */
const MODEL_SCALE = 0.055;
/** Altura de los ojos dentro del modelo (unidades del modelo). */
const MODEL_EYE_Y = 1.45;
/** Corte inferior del escaneo (unidades del modelo). */
const MODEL_MIN_Y = -3.97;

const SKIN: Record<BustId, { color: string; roughness: number; textured: boolean }> = {
  "skin-light": { color: "#ffffff", roughness: 0.52, textured: true },
  "skin-medium": { color: "#ead0c0", roughness: 0.5, textured: true },
  "skin-dark": { color: "#8a6656", roughness: 0.46, textured: true },
  plaster: { color: "#d9d6cf", roughness: 0.92, textured: false },
};


export default function StudioSubject({ subject, yaw }: { subject: BustId; yaw: number }) {
  const gltf = useGLTF(MODEL_URL);
  const [colorMap, normalMap] = useTexture([
    `${MODEL_DIR}/Map-COL.jpg`,
    `${MODEL_DIR}/Infinite-Level_02_Tangent_SmoothUV.jpg`,
  ]);

  const geometry = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((o) => {
      if (!geo && (o as THREE.Mesh).isMesh) geo = (o as THREE.Mesh).geometry;
    });
    return geo as THREE.BufferGeometry | null;
  }, [gltf]);

  const material = useMemo(() => {
    // Las texturas del escaneo vienen aparte del GLB, con la orientación de three.js (flipY).
    colorMap.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ normalMap, normalScale: new THREE.Vector2(0.8, 0.8) });
  }, [colorMap, normalMap]);

  useEffect(() => {
    const skin = SKIN[subject];
    material.map = skin.textured ? colorMap : null;
    material.color.set(skin.color);
    material.roughness = skin.roughness;
    material.needsUpdate = true;
  }, [material, colorMap, subject]);

  useEffect(() => () => material.dispose(), [material]);

  const yawRad = (yaw * Math.PI) / 180;
  const baseY = SUBJECT_HEAD[1] - MODEL_EYE_Y * MODEL_SCALE;
  const scanBottom = baseY + MODEL_MIN_Y * MODEL_SCALE;

  return (
    <group position={[0, 0, 0]} rotation={[0, yawRad, 0]}>
      {geometry ? (
        <mesh
          geometry={geometry}
          material={material}
          position={[0, baseY, 0]}
          scale={MODEL_SCALE}
          castShadow
          receiveShadow
        />
      ) : null}
      {/* Torso simple debajo del corte del escaneo, para que el busto no flote. */}
      <mesh position={[0, scanBottom - 0.34, -0.03]} castShadow receiveShadow>
        <cylinderGeometry args={[0.21, 0.18, 0.7, 32]} />
        <meshStandardMaterial color="#1d1f24" roughness={0.9} />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
