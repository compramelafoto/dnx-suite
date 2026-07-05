"use client";

import { Grid } from "@react-three/drei";
import { useEffect } from "react";

/**
 * Escena mínima para diagnóstico de render.
 * Activar con NEXT_PUBLIC_COD_DEV_DEBUG_SCENE=true
 */
export default function DevDebugScene() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info("[Cam Of Duty] DEV_DEBUG_SCENE activo");
    }
  }, []);

  return (
    <group>
      <ambientLight intensity={2.5} />
      <directionalLight position={[5, 8, 4]} intensity={2} />

      <Grid
        args={[20, 20]}
        cellSize={1}
        cellColor="#666666"
        sectionColor="#888888"
        fadeDistance={24}
        position={[0, 0.01, 0]}
      />
      <axesHelper args={[3]} position={[0, 0.02, 0]} />

      <mesh position={[0, 1.25, -3]} castShadow>
        <boxGeometry args={[2.5, 2.5, 2.5]} />
        <meshBasicMaterial color="#e11d2e" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#9a9aa8" />
      </mesh>
    </group>
  );
}
