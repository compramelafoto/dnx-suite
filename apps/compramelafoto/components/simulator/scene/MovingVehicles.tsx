"use client";

import { VEHICLE_SUBJECT_ID } from "@/lib/simulator/moving-subject-types";
import { syncMovingSubjectsRegistry, simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const PATH = { zMin: -24, zMax: 24, x: 0, speed: 7.5 } as const;

/**
 * Automóvil en la calle — movimiento continuo.
 * TODO: tráfico dinámico, varios vehículos, semáforos.
 */
export default function MovingVehicles() {
  const groupRef = useRef<THREE.Group>(null);
  const dirRef = useRef<1 | -1>(-1);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    group.position.z += dirRef.current * PATH.speed * delta;
    if (group.position.z <= PATH.zMin) dirRef.current = 1;
    if (group.position.z >= PATH.zMax) dirRef.current = -1;

    const velZ = dirRef.current * PATH.speed;
    const state = {
      id: VEHICLE_SUBJECT_ID,
      position: [group.position.x, group.position.y + 0.55, group.position.z] as [
        number,
        number,
        number,
      ],
      speed: PATH.speed,
      direction: dirRef.current,
      velocityX: 0,
      velocity: [0, 0, velZ] as [number, number, number],
      visible: true,
    };

    const others = simulatorRuntime.movingSubjects.filter((s) => s.id !== VEHICLE_SUBJECT_ID);
    syncMovingSubjectsRegistry([...others, state]);
  });

  return (
    <group ref={groupRef} position={[PATH.x, 0, PATH.zMax]} userData={{ codSubjectId: VEHICLE_SUBJECT_ID }}>
      <mesh castShadow receiveShadow position={[0, 0.45, 0]} userData={{ codSubjectId: VEHICLE_SUBJECT_ID }}>
        <boxGeometry args={[1.85, 0.55, 4.1]} />
        <meshStandardMaterial color="#2a3344" roughness={0.35} metalness={0.45} />
      </mesh>
      <mesh castShadow position={[0, 0.82, -0.35]} userData={{ codSubjectId: VEHICLE_SUBJECT_ID }}>
        <boxGeometry args={[1.65, 0.42, 2.1]} />
        <meshStandardMaterial color="#4a5568" roughness={0.3} metalness={0.5} />
      </mesh>
      {([-0.72, 0.72] as const).map((x) =>
        ([-1.35, 1.35] as const).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.22, z]} castShadow userData={{ codSubjectId: VEHICLE_SUBJECT_ID }}>
            <cylinderGeometry args={[0.28, 0.28, 0.12, 12]} />
            <meshStandardMaterial color="#111" roughness={0.5} metalness={0.2} />
          </mesh>
        )),
      )}
    </group>
  );
}
