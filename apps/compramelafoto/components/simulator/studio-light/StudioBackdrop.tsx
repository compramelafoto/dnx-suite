"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { BACKDROP_Z } from "@/lib/simulator/studio-light/metering";
import type { BackdropId } from "@/lib/simulator/studio-light/types";

export const BACKDROPS: Record<BackdropId, { label: string; color: string }> = {
  white: { label: "Blanco", color: "#f2f2f0" },
  grey: { label: "Gris medio", color: "#7d7f82" },
  black: { label: "Negro", color: "#141414" },
  blue: { label: "Azul", color: "#2f5b9a" },
  green: { label: "Croma verde", color: "#2f9a4a" },
  warm: { label: "Arena", color: "#b49a7c" },
};

const PAPER_WIDTH = 5.4;
const PAPER_HEIGHT = 3.6;
const PAPER_FRONT_Z = 1.6;
const COVE_RADIUS = 0.9;

/** Papel de fondo con curva infinita (ciclorama). */
function buildSweep(): THREE.BufferGeometry {
  const profile: [number, number][] = [];
  // Piso: desde adelante hasta el comienzo de la curva.
  const floorEnd = BACKDROP_Z + COVE_RADIUS;
  for (let i = 0; i <= 8; i++) profile.push([PAPER_FRONT_Z + ((floorEnd - PAPER_FRONT_Z) * i) / 8, 0.002]);
  // Curva de un cuarto de círculo.
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2);
    profile.push([floorEnd - Math.sin(a) * COVE_RADIUS, COVE_RADIUS - Math.cos(a) * COVE_RADIUS + 0.002]);
  }
  // Pared.
  for (let i = 1; i <= 6; i++) profile.push([BACKDROP_Z, COVE_RADIUS + ((PAPER_HEIGHT - COVE_RADIUS) * i) / 6]);

  const cols = 24;
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  profile.forEach(([z, y], row) => {
    for (let c = 0; c <= cols; c++) {
      positions.push(-PAPER_WIDTH / 2 + (PAPER_WIDTH * c) / cols, y, z);
      uvs.push(c / cols, row / (profile.length - 1));
    }
  });
  for (let r = 0; r < profile.length - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = a + cols + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

export default function StudioBackdrop({ backdrop }: { backdrop: BackdropId }) {
  const sweep = useMemo(() => buildSweep(), []);
  const color = BACKDROPS[backdrop].color;

  return (
    <group>
      <mesh geometry={sweep} receiveShadow>
        <meshStandardMaterial color={color} roughness={0.96} side={THREE.DoubleSide} />
      </mesh>
      {/* Piso del estudio */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.5]} receiveShadow>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.85} />
      </mesh>
      {/* Soportes del papel */}
      {[-PAPER_WIDTH / 2 - 0.05, PAPER_WIDTH / 2 + 0.05].map((x) => (
        <mesh key={x} position={[x, PAPER_HEIGHT / 2 + 0.1, BACKDROP_Z - 0.05]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, PAPER_HEIGHT + 0.2, 8]} />
          <meshStandardMaterial color="#111" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, PAPER_HEIGHT + 0.12, BACKDROP_Z - 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, PAPER_WIDTH + 0.2, 16]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
}
