"use client";

import {
  PEDESTRIAN_SUBJECT_IDS,
  type MovingSubjectState,
} from "@/lib/simulator/moving-subject-types";
import { syncMovingSubjectsRegistry, simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

interface PedestrianConfig {
  id: string;
  start: [number, number, number];
  axis: "x" | "z";
  min: number;
  max: number;
  speed: number;
  side: "left" | "right";
  shirt: string;
}

const PEDESTRIANS: PedestrianConfig[] = [
  { id: PEDESTRIAN_SUBJECT_IDS[0], start: [-6.2, 0, 14], axis: "z", min: -20, max: 18, speed: 1.35, side: "left", shirt: "#3d6ea8" },
  { id: PEDESTRIAN_SUBJECT_IDS[1], start: [-6.2, 0, -8], axis: "z", min: -22, max: 16, speed: 1.1, side: "left", shirt: "#c24a4a" },
  { id: PEDESTRIAN_SUBJECT_IDS[2], start: [6.2, 0, 10], axis: "z", min: -18, max: 20, speed: 1.25, side: "right", shirt: "#4a8a5c" },
  { id: PEDESTRIAN_SUBJECT_IDS[3], start: [6.2, 0, -14], axis: "z", min: -16, max: 22, speed: 0.95, side: "right", shirt: "#8a6a3a" },
];

function PedestrianMesh({ shirt, subjectId }: { shirt: string; subjectId: string }) {
  return (
    <group userData={{ codSubjectId: subjectId }}>
      <mesh position={[0, 0.9, 0]} castShadow userData={{ codSubjectId: subjectId }}>
        <capsuleGeometry args={[0.22, 0.75, 6, 10]} />
        <meshStandardMaterial color={shirt} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow userData={{ codSubjectId: subjectId }}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#d8c4b0" roughness={0.65} />
      </mesh>
    </group>
  );
}

/**
 * Peatones con rutas simples (caminar / pausa / cruzar).
 * TODO: IA peatonal avanzada, semáforos, multitudes.
 */
export default function MovingPedestrians() {
  const groupsRef = useRef<(THREE.Group | null)[]>([]);
  const stateRef = useRef(
    PEDESTRIANS.map((p) => ({
      dir: 1 as 1 | -1,
      pauseMs: 0,
      pos: p.axis === "z" ? p.start[2] : p.start[0],
    })),
  );

  const configs = useMemo(() => PEDESTRIANS, []);

  useFrame((_, delta) => {
    const states: MovingSubjectState[] = [];

    configs.forEach((cfg, i) => {
      const group = groupsRef.current[i];
      const st = stateRef.current[i];
      if (!group) return;

      if (st.pauseMs > 0) {
        st.pauseMs -= delta * 1000;
      } else {
        st.pos += st.dir * cfg.speed * delta;
        if (st.pos >= cfg.max) {
          st.pos = cfg.max;
          st.dir = -1;
          if (Math.random() < 0.08) st.pauseMs = 1200 + Math.random() * 2000;
        }
        if (st.pos <= cfg.min) {
          st.pos = cfg.min;
          st.dir = 1;
          if (Math.random() < 0.08) st.pauseMs = 1200 + Math.random() * 2000;
        }
      }

      if (cfg.axis === "z") {
        group.position.set(cfg.start[0], cfg.start[1], st.pos);
      } else {
        group.position.set(st.pos, cfg.start[1], cfg.start[2]);
      }

      const velZ = cfg.axis === "z" ? st.dir * cfg.speed : 0;
      const velX = cfg.axis === "x" ? st.dir * cfg.speed : 0;

      states.push({
        id: cfg.id,
        position: [group.position.x, group.position.y + 0.9, group.position.z],
        speed: cfg.speed,
        direction: st.dir,
        velocityX: velX,
        velocity: [velX, 0, velZ],
        visible: true,
      });
    });

    const existing = simulatorRuntime.movingSubjects.filter(
      (s) => !(PEDESTRIAN_SUBJECT_IDS as readonly string[]).includes(s.id),
    );
    syncMovingSubjectsRegistry([...existing, ...states]);
  });

  return (
    <group>
      {configs.map((cfg, i) => (
        <group
          key={cfg.id}
          ref={(el) => {
            groupsRef.current[i] = el;
          }}
          position={cfg.start}
        >
          <PedestrianMesh shirt={cfg.shirt} subjectId={cfg.id} />
        </group>
      ))}
    </group>
  );
}
