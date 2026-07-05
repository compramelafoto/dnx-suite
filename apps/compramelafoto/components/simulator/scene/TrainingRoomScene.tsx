"use client";

import { Grid } from "@react-three/drei";
import { useEffect } from "react";
import MovingSubject from "./MovingSubject";

/** Estudio fotográfico de entrenamiento — reconstruido con materiales y luces más visibles. */
const ROOM = {
  floor: 22,
  wallH: 5,
  wallZ: -9,
} as const;

function PropBox({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  const [w, h, d] = size;
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.65} metalness={0.08} />
    </mesh>
  );
}

function MannequinBust() {
  return (
    <group position={[0, 0, -6]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.45, 1, 24]} />
        <meshStandardMaterial color="#8a8580" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[1, 0.35, 0.4]} />
        <meshStandardMaterial color="#9a9590" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color="#b0a8a0" roughness={0.6} />
      </mesh>
    </group>
  );
}

export default function TrainingRoomScene() {
  const half = ROOM.floor / 2;

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info("[Cam Of Duty] TrainingRoomScene mounted");
    }
  }, []);

  return (
    <group>
      {/* Iluminación global — intensidades fijas, sin mutación por frame */}
      <hemisphereLight args={["#d8e8ff", "#5a5a68", 1.1]} />
      <ambientLight intensity={0.55} color="#eef2ff" />
      <directionalLight
        position={[4, 10, 6]}
        intensity={2.8}
        color="#fff0e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={40}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0002}
      />

      {/* Zona iluminada (derecha) */}
      <spotLight
        position={[7, 6.5, 1.5]}
        angle={0.62}
        penumbra={0.45}
        intensity={32}
        color="#fff8f0"
        distance={18}
        decay={1.8}
        castShadow
      >
        <object3D attach="target" position={[7, 0, 1.5]} />
      </spotLight>

      {/* Ventana trasera */}
      <pointLight position={[-3, 3.2, ROOM.wallZ + 1]} intensity={18} color="#b8dcff" distance={12} decay={1.6} />

      {/* Zona oscura (izquierda) — contraste pedagógico */}
      <pointLight position={[-7, 2.5, -3]} intensity={0.55} color="#6070a0" distance={6} decay={2} />

      {/* Piso principal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[ROOM.floor, ROOM.floor]} />
        <meshStandardMaterial color="#4a4a56" roughness={0.82} metalness={0.04} />
      </mesh>

      {/* Parche zona clara */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[6.5, 0.01, 1.5]}>
        <planeGeometry args={[5.5, 5.5]} />
        <meshStandardMaterial color="#6a6a78" roughness={0.78} />
      </mesh>

      {/* Parche zona oscura */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[-7, 0.01, -3]}>
        <planeGeometry args={[4.5, 4.5]} />
        <meshStandardMaterial color="#2a2a34" roughness={0.9} />
      </mesh>

      <Grid
        args={[ROOM.floor, ROOM.floor]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#5a5a68"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#6e6e7c"
        fadeDistance={28}
        fadeStrength={1}
        infiniteGrid={false}
        position={[0, 0.015, 0]}
      />

      {/* Marcadores de zona */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.5, 0.025, 4]}>
        <planeGeometry args={[3.5, 0.4]} />
        <meshStandardMaterial color="#e11d2e" emissive="#e11d2e" emissiveIntensity={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-7, 0.025, -5.5]}>
        <planeGeometry args={[3.5, 0.4]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.45} />
      </mesh>

      {/* Paredes */}
      <mesh position={[0, ROOM.wallH / 2, ROOM.wallZ]} receiveShadow castShadow>
        <boxGeometry args={[ROOM.floor, ROOM.wallH, 0.3]} />
        <meshStandardMaterial color="#52525e" roughness={0.8} />
      </mesh>
      <mesh position={[-half, ROOM.wallH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.3, ROOM.wallH, ROOM.floor]} />
        <meshStandardMaterial color="#4a4a56" roughness={0.82} />
      </mesh>
      <mesh position={[half, ROOM.wallH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.3, ROOM.wallH, ROOM.floor]} />
        <meshStandardMaterial color="#4a4a56" roughness={0.82} />
      </mesh>

      {/* Ventana emisiva */}
      <mesh position={[-3, 3, ROOM.wallZ + 0.16]}>
        <planeGeometry args={[3.2, 2.4]} />
        <meshStandardMaterial color="#e8f4ff" emissive="#7ec0ff" emissiveIntensity={1.8} />
      </mesh>

      {/* Props con color para referencia visual */}
      <PropBox position={[-4.5, 0.6, -2]} size={[1.2, 1.2, 1.2]} color="#c27b3d" />
      <PropBox position={[4, 0.45, -1]} size={[0.9, 0.9, 1.5]} color="#4a7ab8" />
      <PropBox position={[2.5, 0.3, 3]} size={[1.8, 0.6, 1]} color="#6b8f5e" />

      <MannequinBust />
      <MovingSubject />

      {/* Referencia de color en el centro — ayuda a confirmar que WebGL renderiza */}
      <mesh position={[0, 2.5, -4]} castShadow>
        <boxGeometry args={[1.2, 1.2, 0.15]} />
        <meshStandardMaterial color="#e11d2e" emissive="#e11d2e" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}
