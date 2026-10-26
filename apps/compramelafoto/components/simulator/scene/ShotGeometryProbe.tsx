"use client";

import { findMovingSubject } from "@/lib/simulator/moving-subject-types";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { computeViewfinderInsets } from "@/lib/simulator/viewfinder-frame";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

const _euler = new THREE.Euler(0, 0, 0, "YXZ");
const _v = new THREE.Vector3();

/**
 * Deja a mano, para el curso, la geometría de la toma: altura de la cámara,
 * inclinación y dónde quedó el sujeto enfocado dentro del recuadro de la foto.
 */
export default function ShotGeometryProbe() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useEffect(() => {
    simulatorRuntime.shotGeometry = () => {
      const world = simulatorRuntime.walkableWorld;
      const ground = world ? world.groundHeight(camera.position.x, camera.position.z) : 0;
      _euler.setFromQuaternion(camera.quaternion, "YXZ");
      const subject = findMovingSubject(simulatorRuntime.movingSubjects, simulatorRuntime.focusedObjectId);
      let subjectDistanceM: number | null = null;
      let subjectFrameX: number | null = null;
      let subjectFrameY: number | null = null;
      if (subject) {
        // A la altura del pecho: es lo que uno encuadra de una persona.
        _v.set(subject.position[0], subject.position[1] + 1.2, subject.position[2]);
        subjectDistanceM = _v.distanceTo(camera.position);
        _v.project(camera);
        const insets = computeViewfinderInsets(size.width, size.height);
        const u = (_v.x + 1) / 2;
        const v = (1 - _v.y) / 2;
        const fx = (u - insets.x) / Math.max(1e-6, 1 - 2 * insets.x);
        const fy = (v - insets.top) / Math.max(1e-6, 1 - insets.top - insets.bottom);
        if (_v.z < 1 && fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) {
          subjectFrameX = fx;
          subjectFrameY = fy;
        }
      }
      return {
        cameraHeightM: camera.position.y - ground,
        rollDeg: THREE.MathUtils.radToDeg(_euler.z),
        subjectDistanceM,
        subjectFrameX,
        subjectFrameY,
      };
    };
    simulatorRuntime.cameraPose = () => {
      _euler.setFromQuaternion(camera.quaternion, "YXZ");
      return {
        position: [camera.position.x, camera.position.y, camera.position.z],
        // Rumbo como el de los flashes: 0 = hacia +Z.
        yawDeg: THREE.MathUtils.radToDeg(_euler.y) + 180,
        pitchDeg: THREE.MathUtils.radToDeg(_euler.x),
      };
    };
    return () => {
      simulatorRuntime.shotGeometry = null;
      simulatorRuntime.cameraPose = null;
    };
  }, [camera, size.width, size.height]);

  return null;
}
