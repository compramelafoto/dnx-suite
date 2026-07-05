"use client";

import { MOVING_SUBJECT_ID } from "@/lib/simulator/moving-subject-types";
import { syncMovingSubjectsRegistry } from "@/lib/simulator/simulator-runtime";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const PATH = { xMin: -4, xMax: 8, z: 2.2, y: 0.35 } as const;
const SPEED = 2.4;

/**
 * Sujeto en movimiento lateral — enseña tiempo de exposición y barrido.
 *
 * TODO (etapas futuras):
 * - Múltiples sujetos con ids distintos
 * - Velocidad variable pedagógica
 */
export default function MovingSubject() {
  const groupRef = useRef<THREE.Group>(null);
  const directionRef = useRef<1 | -1>(1);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    group.position.x += directionRef.current * SPEED * delta;
    if (group.position.x >= PATH.xMax) directionRef.current = -1;
    if (group.position.x <= PATH.xMin) directionRef.current = 1;

    const state = {
      id: MOVING_SUBJECT_ID,
      position: [group.position.x, group.position.y, group.position.z] as [number, number, number],
      speed: SPEED,
      direction: directionRef.current,
      velocityX: directionRef.current * SPEED,
      velocity: [directionRef.current * SPEED, 0, 0] as [number, number, number],
      visible: true,
    };
    syncMovingSubjectsRegistry([state]);
  });

  return (
    <group ref={groupRef} position={[PATH.xMin, PATH.y, PATH.z]} userData={{ codSubjectId: MOVING_SUBJECT_ID }}>
      <mesh castShadow receiveShadow position={[0, 0.15, 0]} userData={{ codSubjectId: MOVING_SUBJECT_ID }}>
        <boxGeometry args={[1.4, 0.3, 0.5]} />
        <meshStandardMaterial color="#c27b3d" roughness={0.55} metalness={0.12} />
      </mesh>
      <mesh castShadow position={[-0.45, 0, 0.22]}>
        <cylinderGeometry args={[0.22, 0.22, 0.08, 16]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0.45, 0, 0.22]}>
        <cylinderGeometry args={[0.22, 0.22, 0.08, 16]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[-0.45, 0, -0.22]}>
        <cylinderGeometry args={[0.22, 0.22, 0.08, 16]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0.45, 0, -0.22]}>
        <cylinderGeometry args={[0.22, 0.22, 0.08, 16]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0.55, 0.42, 0]}>
        <boxGeometry args={[0.12, 0.35, 0.08]} />
        <meshStandardMaterial color="#4a4a54" roughness={0.6} />
      </mesh>
    </group>
  );
}
