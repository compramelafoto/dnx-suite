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
import { pickIdleClip } from "@/lib/simulator/pedestrian-animation";
import {
  findPedestrianHeadNode,
  resolvePedestrianFocusOffset,
} from "@/lib/simulator/pedestrian-focus";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GlTFAssetSlotDevMarker } from "./GlTFAssetSlotDevMarker";

type StaticPhase = "idle" | "checking" | "missing" | "ready";

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

function tagPedestrianSubjectId(root: THREE.Object3D, subjectId: string): void {
  root.traverse((obj) => {
    obj.userData.codSubjectId = subjectId;
    obj.userData.codSubjectKind = "human";
  });
}

/**
 * Peatón glTF estático — retrato ambiental, AF-S al rostro (sin registro móvil).
 */
export function PhotographicStaticPedestrianInstance({ slot }: { slot: PhotographicAssetSlot }) {
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const [phase, setPhase] = useState<StaticPhase>("idle");

  const subjectId = slot.focusSubjectId ?? slot.id;
  const url = slot.filename != null ? codAssetUrl(slot.category, slot.filename) : null;
  const isDevMissing = phase === "missing" && process.env.NODE_ENV === "development";

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
        focusSubjectId: subjectId,
      });
      setPhase(exists ? "ready" : "missing");
    });
  }, [slot.id, slot.kind, slot.label, subjectId, url]);

  useEffect(() => {
    if (phase !== "ready" || !url || !groupRef.current) return;

    let cancelled = false;
    const loader = createGltfLoader(gl, { ktx2: true, draco: true });

    logGltfDev("loading", {
      slotId: slot.id,
      label: slot.label,
      kind: slot.kind,
      url,
      focusSubjectId: subjectId,
    });

    loader
      .loadAsync(url)
      .then((gltf) => {
        if (cancelled || !groupRef.current) return;

        const model = gltf.scene.clone(true);
        const stats = prepareGltfScene(model, slot);
        tagPedestrianSubjectId(model, subjectId);

        const focus = resolvePedestrianFocusOffset(model, stats.boundingBox);
        const idleClip = pickIdleClip(gltf.animations);
        if (idleClip) {
          const mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(idleClip).play();
          mixerRef.current = mixer;
        } else {
          mixerRef.current = null;
        }

        groupRef.current.clear();
        groupRef.current.add(model);

        const boxFmt = formatBoundingBox(stats.boundingBox);
        logGltfDev("loaded", {
          slotId: slot.id,
          label: slot.label,
          kind: slot.kind,
          url,
          meshCount: stats.meshCount,
          materialCount: stats.materialCount,
          boundingBox: boxFmt,
          focusSubjectId: subjectId,
          focusPoint: focus.source,
          focusHeadNode: focus.headNodeName,
          idleAnimation: idleClip?.name ?? null,
          staticPedestrian: true,
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
      mixerRef.current = null;
    };
  }, [gl, phase, slot, subjectId, url]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.position.set(slot.position[0], slot.position[1], slot.position[2]);
    applySlotTransform(group, slot);
  }, [slot]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  if (!url || phase === "idle" || phase === "checking") return null;
  if (phase === "missing" && process.env.NODE_ENV !== "development") return null;

  return (
    <group
      ref={groupRef}
      name={`cod-photographic-pedestrian-static-${slot.id}`}
      userData={{
        codAssetSlot: slot.id,
        codSubjectId: subjectId,
        codSubjectKind: "human",
      }}
    >
      {isDevMissing ? (
        <group position={[0, 0, 0]}>
          <GlTFAssetSlotDevMarker slot={slot} subjectId={subjectId} />
          <mesh position={[0, 0.42, 0.22]} userData={{ codSubjectId: subjectId }}>
            <boxGeometry args={[0.5, 0.12, 0.5]} />
            <meshBasicMaterial color="#6a5a48" wireframe transparent opacity={0.35} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}
