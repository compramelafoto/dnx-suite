"use client";

import {
  assetFileExists,
  codAssetUrl,
  createGltfLoader,
  formatBoundingBox,
  logGltfDev,
  prepareGltfScene,
  applySlotTransform,
} from "@/lib/simulator/assets";
import type { PhotographicAssetSlot } from "@/lib/simulator/assets";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export interface GlTFAssetSlotProps {
  slot: PhotographicAssetSlot;
}

type SlotPhase = "idle" | "checking" | "missing" | "ready" | "error";

import { GlTFAssetSlotDevMarker } from "./GlTFAssetSlotDevMarker";
function GlTFAssetSlotModel({
  slot,
  url,
}: {
  slot: PhotographicAssetSlot;
  url: string;
}) {
  const { gl } = useThree();
  const rootRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
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
        if (cancelled || !rootRef.current) return;

        const model = gltf.scene.clone(true);
        const stats = prepareGltfScene(model, slot);

        rootRef.current.clear();
        rootRef.current.add(model);
        modelRef.current = model;

        const boxFmt = formatBoundingBox(stats.boundingBox);

        logGltfDev("loaded", {
          slotId: slot.id,
          label: slot.label,
          kind: slot.kind,
          url,
          meshCount: stats.meshCount,
          materialCount: stats.materialCount,
          boundingBox: boxFmt,
          sceneSize: `${boxFmt.size[0].toFixed(2)} × ${boxFmt.size[1].toFixed(2)} × ${boxFmt.size[2].toFixed(2)} m`,
        });
      })
      .catch((err) => {
        logGltfDev("load-error", {
          slotId: slot.id,
          url,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      cancelled = true;
      modelRef.current = null;
      rootRef.current?.clear();
    };
  }, [gl, slot, url]);

  return (
    <group
      ref={rootRef}
      name={`cod-gltf-slot-${slot.id}`}
      userData={{ codAssetSlot: slot.id, codAssetKind: slot.kind }}
    />
  );
}

/**
 * Slot de asset glTF — carga real con Draco/KTX2 cuando el archivo existe.
 */
export default function GlTFAssetSlot({ slot }: GlTFAssetSlotProps) {
  const [phase, setPhase] = useState<SlotPhase>("idle");
  const wrapperRef = useRef<THREE.Group>(null);

  const url =
    slot.filename != null ? codAssetUrl(slot.category, slot.filename) : null;

  useEffect(() => {
    if (!url) {
      setPhase("idle");
      return;
    }

    let cancelled = false;
    setPhase("checking");

    void assetFileExists(url).then((exists) => {
      if (cancelled) return;
      if (!exists) {
        logGltfDev("missing", {
          slotId: slot.id,
          label: slot.label,
          url,
        });
        setPhase("missing");
        return;
      }
      logGltfDev("found", {
        slotId: slot.id,
        label: slot.label,
        kind: slot.kind,
        url,
      });
      setPhase("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [url, slot.id, slot.label]);

  useEffect(() => {
    if (!wrapperRef.current) return;
    applySlotTransform(wrapperRef.current, slot);
  }, [slot]);

  if (!url || phase === "idle" || phase === "checking") return null;

  if (phase === "missing" || phase === "error") {
    return <GlTFAssetSlotDevMarker slot={slot} />;
  }

  return (
    <group ref={wrapperRef}>
      <GlTFAssetSlotModel slot={slot} url={url} />
    </group>
  );
}
