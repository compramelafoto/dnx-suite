"use client";

import {
  PHOTOGRAPHIC_VEHICLE_MAIN_SLOT,
  assetFileExists,
  codAssetUrl,
  createGltfLoader,
  formatBoundingBox,
  logGltfDev,
  prepareGltfScene,
} from "@/lib/simulator/assets";
import { PHOTOGRAPHIC_VEHICLE_SUBJECT_ID } from "@/lib/simulator/moving-subject-types";
import {
  photographicVehicleRuntime,
} from "@/lib/simulator/photographic-vehicle-runtime";
import { syncMovingSubjectsRegistry, simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GlTFAssetSlotDevMarker } from "./GlTFAssetSlotDevMarker";

const SLOT = PHOTOGRAPHIC_VEHICLE_MAIN_SLOT;

type VehiclePhase = "idle" | "checking" | "missing" | "ready";

function tagVehicleSubjectId(root: THREE.Object3D, subjectId: string): void {
  root.traverse((obj) => {
    obj.userData.codSubjectId = subjectId;
  });
}

function applySlotRotation(group: THREE.Group): void {
  if (SLOT.rotation) {
    group.rotation.set(SLOT.rotation[0], SLOT.rotation[1], SLOT.rotation[2]);
  } else {
    group.rotation.set(0, SLOT.rotationY ?? 0, 0);
  }
  if (typeof SLOT.scale === "number") {
    group.scale.setScalar(SLOT.scale);
  } else if (SLOT.scale) {
    group.scale.set(SLOT.scale[0], SLOT.scale[1], SLOT.scale[2]);
  }
}

/**
 * Vehículo glTF real con movimiento lateral — sujeto AF-C y barrido.
 */
export default function PhotographicMovingVehicle() {
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const directionRef = useRef<1 | -1>(1);
  const focusHeightRef = useRef(0.85);
  const [phase, setPhase] = useState<VehiclePhase>("idle");
  const lastDevLogMs = useRef(0);

  const url =
    SLOT.filename != null ? codAssetUrl(SLOT.category, SLOT.filename) : null;
  const motion = SLOT.motion;
  const subjectId = motion?.subjectId ?? PHOTOGRAPHIC_VEHICLE_SUBJECT_ID;

  useEffect(() => {
    if (!url) {
      setPhase("idle");
      return;
    }
    setPhase("checking");
    void assetFileExists(url).then((exists) => {
      logGltfDev(exists ? "found" : "missing", {
        slotId: SLOT.id,
        label: SLOT.label,
        kind: SLOT.kind,
        url,
      });
      setPhase(exists ? "ready" : "missing");
    });
  }, [url]);

  useEffect(() => {
    if (phase !== "ready" || !url || !groupRef.current) return;

    let cancelled = false;
    const loader = createGltfLoader(gl, { ktx2: true, draco: true });

    logGltfDev("loading", {
      slotId: SLOT.id,
      label: SLOT.label,
      kind: SLOT.kind,
      url,
    });

    loader
      .loadAsync(url)
      .then((gltf) => {
        if (cancelled || !groupRef.current) return;

        const model = gltf.scene.clone(true);
        const stats = prepareGltfScene(model, SLOT);
        tagVehicleSubjectId(model, subjectId);

        const boxFmt = formatBoundingBox(stats.boundingBox);
        focusHeightRef.current = Math.max(0.5, boxFmt.size[1] * 0.42);

        groupRef.current.clear();
        groupRef.current.add(model);

        logGltfDev("loaded", {
          slotId: SLOT.id,
          label: SLOT.label,
          kind: SLOT.kind,
          url,
          meshCount: stats.meshCount,
          materialCount: stats.materialCount,
          boundingBox: boxFmt,
          sceneSize: `${boxFmt.size[0].toFixed(2)} × ${boxFmt.size[1].toFixed(2)} × ${boxFmt.size[2].toFixed(2)} m`,
          movingSubjectId: subjectId,
        });
      })
      .catch((err) => {
        logGltfDev("load-error", {
          slotId: SLOT.id,
          url,
          error: err instanceof Error ? err.message : String(err),
        });
        setPhase("missing");
      });

    return () => {
      cancelled = true;
    };
  }, [gl, phase, subjectId, url]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.position.set(SLOT.position[0], SLOT.position[1], SLOT.position[2]);
    applySlotRotation(group);

    return () => {
      const others = simulatorRuntime.movingSubjects.filter((s) => s.id !== subjectId);
      syncMovingSubjectsRegistry(others);
    };
  }, [subjectId]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!motion) return;

    const unregister = () => {
      const others = simulatorRuntime.movingSubjects.filter((s) => s.id !== subjectId);
      syncMovingSubjectsRegistry(others);
    };

    if (phase !== "ready" || !group || !photographicVehicleRuntime.enabled) {
      if (group) group.visible = photographicVehicleRuntime.enabled;
      unregister();
      return;
    }

    group.visible = true;

    const speed = photographicVehicleRuntime.getSpeedMs();

    if (motion.axis === "x") {
      group.position.x += directionRef.current * speed * delta;
      if (group.position.x >= motion.max) directionRef.current = -1;
      if (group.position.x <= motion.min) directionRef.current = 1;
      group.position.z = motion.fixedZ ?? SLOT.position[2];
    } else {
      group.position.z += directionRef.current * speed * delta;
      if (group.position.z >= motion.max) directionRef.current = -1;
      if (group.position.z <= motion.min) directionRef.current = 1;
      group.position.x = motion.fixedX ?? SLOT.position[0];
    }

    group.position.y = SLOT.position[1];

    const velX = motion.axis === "x" ? directionRef.current * speed : 0;
    const velZ = motion.axis === "z" ? directionRef.current * speed : 0;
    const focusY = group.position.y + focusHeightRef.current;
    const worldPosition: [number, number, number] = [
      group.position.x,
      focusY,
      group.position.z,
    ];

    const state = {
      id: subjectId,
      position: worldPosition,
      speed,
      direction: directionRef.current,
      velocityX: velX,
      velocity: [velX, 0, velZ] as [number, number, number],
      visible: true,
    };

    const others = simulatorRuntime.movingSubjects.filter((s) => s.id !== subjectId);
    syncMovingSubjectsRegistry([...others, state]);

    if (process.env.NODE_ENV === "development") {
      const now = performance.now();
      if (now - lastDevLogMs.current > 5000) {
        lastDevLogMs.current = now;
        console.info("[Cam Of Duty · Vehículo]", {
          subjectId,
          worldPosition,
          velocity: state.velocity,
          speedPreset: photographicVehicleRuntime.speedPreset,
        });
      }
    }
  });

  if (!url || phase === "idle" || phase === "checking") return null;

  if (phase === "missing") {
    return <GlTFAssetSlotDevMarker slot={SLOT} />;
  }

  return (
    <group
      ref={groupRef}
      name="cod-photographic-vehicle-main"
      userData={{ codAssetSlot: SLOT.id, codSubjectId: subjectId }}
    />
  );
}
