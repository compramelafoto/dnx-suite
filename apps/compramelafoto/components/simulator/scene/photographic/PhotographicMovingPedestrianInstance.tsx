"use client";

import {
  type PhotographicAssetSlot,
  assetFileExists,
  codAssetUrl,
  createGltfLoader,
  formatBoundingBox,
  logGltfDev,
  prepareGltfScene,
} from "@/lib/simulator/assets";
import {
  beginTurnaroundPause,
  createPedestrianClipActions,
  resumeWalkAfterPause,
  type PedestrianClipActions,
} from "@/lib/simulator/pedestrian-animation";
import {
  findPedestrianHeadNode,
  pedestrianFocusWorldPosition,
  resolvePedestrianFocusOffset,
} from "@/lib/simulator/pedestrian-focus";
import { photographicPedestrianRuntime } from "@/lib/simulator/photographic-pedestrian-runtime";
import { syncMovingSubjectsRegistry, simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GlTFAssetSlotDevMarker } from "./GlTFAssetSlotDevMarker";

const DEV_FOCUS_HEAD_Y = 1.62;

type PedestrianPhase = "idle" | "checking" | "missing" | "ready";

function tagPedestrianSubjectId(root: THREE.Object3D, subjectId: string): void {
  root.traverse((obj) => {
    obj.userData.codSubjectId = subjectId;
    obj.userData.codSubjectKind = "human";
  });
}

function applySlotTransform(group: THREE.Group, slot: PhotographicAssetSlot): void {
  if (slot.rotation) {
    group.rotation.set(slot.rotation[0], slot.rotation[1], slot.rotation[2]);
  } else {
    group.rotation.set(0, slot.rotationY ?? 0, 0);
  }
  if (typeof slot.scale === "number") {
    group.scale.setScalar(slot.scale);
  } else if (slot.scale) {
    group.scale.set(slot.scale[0], slot.scale[1], slot.scale[2]);
  }
}

function resolveBaseRotationY(slot: PhotographicAssetSlot): number {
  return slot.rotation?.[1] ?? slot.rotationY ?? 0;
}

function facingRotationY(
  slot: PhotographicAssetSlot,
  motion: NonNullable<PhotographicAssetSlot["motion"]>,
  direction: 1 | -1,
): number {
  const base = resolveBaseRotationY(slot);
  if (motion.axis === "z") {
    return direction > 0 ? base : base + Math.PI;
  }
  return direction > 0 ? base + Math.PI / 2 : base - Math.PI / 2;
}

export function PhotographicMovingPedestrianInstance({ slot }: { slot: PhotographicAssetSlot }) {
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const directionRef = useRef<1 | -1>(slot.motion?.initialDirection ?? 1);
  const focusLocalRef = useRef(new THREE.Vector3(0, 1.65, 0));
  const focusWorldRef = useRef(new THREE.Vector3());
  const headNodeRef = useRef<THREE.Object3D | null>(null);
  const clipActionsRef = useRef<PedestrianClipActions | null>(null);
  const pauseUntilMsRef = useRef(0);
  const [phase, setPhase] = useState<PedestrianPhase>("idle");
  const lastDevLogMs = useRef(0);

  const url = slot.filename != null ? codAssetUrl(slot.category, slot.filename) : null;
  const motion = slot.motion;
  const subjectId = motion?.subjectId ?? slot.id;
  const isDevMissing = phase === "missing" && process.env.NODE_ENV === "development";
  const isMotionActive = phase === "ready" || isDevMissing;

  useEffect(() => {
    directionRef.current = motion?.initialDirection ?? 1;
  }, [motion?.initialDirection, slot.id]);

  useEffect(() => {
    if (!url) {
      setPhase("idle");
      return;
    }
    setPhase("checking");
    void assetFileExists(url).then((exists) => {
      logGltfDev(exists ? "found" : "missing", {
        slotId: slot.id,
        label: slot.label,
        kind: slot.kind,
        url,
      });
      setPhase(exists ? "ready" : "missing");
    });
  }, [slot.id, slot.kind, slot.label, url]);

  useEffect(() => {
    if (phase !== "ready" || !url || !groupRef.current) return;

    let cancelled = false;
    const loader = createGltfLoader(gl, { ktx2: true, draco: true });

    logGltfDev("loading", {
      slotId: slot.id,
      label: slot.label,
      kind: slot.kind,
      url,
    });

    loader
      .loadAsync(url)
      .then((gltf) => {
        if (cancelled || !groupRef.current) return;

        const model = gltf.scene.clone(true);
        const stats = prepareGltfScene(model, slot);
        tagPedestrianSubjectId(model, subjectId);

        const focus = resolvePedestrianFocusOffset(model, stats.boundingBox);
        focusLocalRef.current.copy(focus.localOffset);
        headNodeRef.current = findPedestrianHeadNode(model);

        clipActionsRef.current = createPedestrianClipActions(model, gltf.animations);

        groupRef.current.clear();
        groupRef.current.add(model);

        const boxFmt = formatBoundingBox(stats.boundingBox);
        const walkClip = clipActionsRef.current.walk?.getClip();
        const idleClip = clipActionsRef.current.idle?.getClip();

        logGltfDev("loaded", {
          slotId: slot.id,
          label: slot.label,
          kind: slot.kind,
          url,
          meshCount: stats.meshCount,
          materialCount: stats.materialCount,
          boundingBox: boxFmt,
          sceneSize: `${boxFmt.size[0].toFixed(2)} × ${boxFmt.size[1].toFixed(2)} × ${boxFmt.size[2].toFixed(2)} m`,
          movingSubjectId: subjectId,
          animationCount: gltf.animations.length,
          animationNames: gltf.animations.map((a) => a.name),
          activeAnimation: walkClip?.name ?? null,
          idleAnimation: idleClip?.name ?? null,
          focusPoint: focus.source,
          focusHeadNode: focus.headNodeName,
        });
      })
      .catch((err) => {
        logGltfDev("load-error", {
          slotId: slot.id,
          url,
          error: err instanceof Error ? err.message : String(err),
        });
        setPhase("missing");
      });

    return () => {
      cancelled = true;
      clipActionsRef.current = null;
      headNodeRef.current = null;
      pauseUntilMsRef.current = 0;
    };
  }, [gl, phase, slot, subjectId, url]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.position.set(slot.position[0], slot.position[1], slot.position[2]);
    applySlotTransform(group, slot);

    return () => {
      const others = simulatorRuntime.movingSubjects.filter((s) => s.id !== subjectId);
      syncMovingSubjectsRegistry(others);
    };
  }, [slot, subjectId]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!motion) return;

    const unregister = () => {
      const others = simulatorRuntime.movingSubjects.filter((s) => s.id !== subjectId);
      syncMovingSubjectsRegistry(others);
    };

    if (!isMotionActive || !group || !photographicPedestrianRuntime.enabled) {
      if (group) group.visible = photographicPedestrianRuntime.enabled;
      unregister();
      return;
    }

    group.visible = true;
    clipActionsRef.current?.mixer.update(delta);

    const now = performance.now();
    const isPausing = pauseUntilMsRef.current > now;
    const speed = isPausing ? 0 : photographicPedestrianRuntime.getSpeedMs();

    if (!isPausing) {
      const prevDirection = directionRef.current;

      if (motion.axis === "x") {
        group.position.x += directionRef.current * speed * delta;
        if (group.position.x >= motion.max) directionRef.current = -1;
        if (group.position.x <= motion.min) directionRef.current = 1;
        group.position.z = motion.fixedZ ?? slot.position[2];
      } else {
        group.position.z += directionRef.current * speed * delta;
        if (group.position.z >= motion.max) directionRef.current = -1;
        if (group.position.z <= motion.min) directionRef.current = 1;
        group.position.x = motion.fixedX ?? slot.position[0];
      }

      if (prevDirection !== directionRef.current && clipActionsRef.current) {
        pauseUntilMsRef.current = beginTurnaroundPause(clipActionsRef.current);
      }
    } else if (clipActionsRef.current && now >= pauseUntilMsRef.current) {
      pauseUntilMsRef.current = 0;
      resumeWalkAfterPause(clipActionsRef.current);
    }

    group.position.y = slot.position[1];
    group.rotation.y = facingRotationY(slot, motion, directionRef.current);
    group.updateMatrixWorld(true);

    if (headNodeRef.current) {
      headNodeRef.current.getWorldPosition(focusWorldRef.current);
    } else if (isDevMissing) {
      focusWorldRef.current.set(
        group.position.x,
        group.position.y + DEV_FOCUS_HEAD_Y,
        group.position.z,
      );
    } else {
      pedestrianFocusWorldPosition(group, focusLocalRef.current, focusWorldRef.current);
    }

    const effectiveSpeed = isPausing ? 0 : photographicPedestrianRuntime.getSpeedMs();
    const velX = motion.axis === "x" ? directionRef.current * effectiveSpeed : 0;
    const velZ = motion.axis === "z" ? directionRef.current * effectiveSpeed : 0;
    const worldPosition: [number, number, number] = [
      focusWorldRef.current.x,
      focusWorldRef.current.y,
      focusWorldRef.current.z,
    ];

    const state = {
      id: subjectId,
      subjectKind: "human" as const,
      position: worldPosition,
      speed: effectiveSpeed,
      direction: directionRef.current,
      velocityX: velX,
      velocity: [velX, 0, velZ] as [number, number, number],
      visible: true,
    };

    const others = simulatorRuntime.movingSubjects.filter((s) => s.id !== subjectId);
    syncMovingSubjectsRegistry([...others, state]);

    if (process.env.NODE_ENV === "development") {
      if (now - lastDevLogMs.current > 5000) {
        lastDevLogMs.current = now;
        console.info("[Cam Of Duty · Peatón]", {
          slotId: slot.id,
          subjectId,
          worldPosition,
          velocity: state.velocity,
          speedPreset: photographicPedestrianRuntime.speedPreset,
          phase,
          isPausing,
          focusSource: headNodeRef.current ? "head" : isDevMissing ? "dev-marker" : "bbox",
        });
      }
    }
  });

  if (!url || phase === "idle" || phase === "checking") return null;
  if (phase === "missing" && process.env.NODE_ENV !== "development") return null;

  return (
    <group
      ref={groupRef}
      name={`cod-photographic-pedestrian-${slot.id}`}
      userData={{
        codAssetSlot: slot.id,
        codSubjectId: subjectId,
        codSubjectKind: "human",
      }}
    >
      {isDevMissing ? <GlTFAssetSlotDevMarker slot={slot} subjectId={subjectId} /> : null}
    </group>
  );
}
