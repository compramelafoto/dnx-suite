"use client";

import type { PhotographicAssetSlot } from "@/lib/simulator/assets";

export function GlTFAssetSlotDevMarker({
  slot,
  subjectId,
}: {
  slot: PhotographicAssetSlot;
  /** Para raycast AF en dev sin glTF. */
  subjectId?: string;
}) {
  const raycastId = subjectId ?? slot.motion?.subjectId;
  if (process.env.NODE_ENV !== "development") return null;

  const rotation = slot.rotation
    ? ([slot.rotation[0], slot.rotation[1], slot.rotation[2]] as [number, number, number])
    : ([0, slot.rotationY ?? 0, 0] as [number, number, number]);

  if (slot.kind === "surface") {
    return (
      <group
        name={`cod-gltf-slot-dev-${slot.id}`}
        position={[slot.position[0], slot.position[1] + 0.01, slot.position[2]]}
        rotation={rotation}
        userData={{ codAssetSlotDev: slot.id, codAssetKind: slot.kind }}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 28]} />
          <meshBasicMaterial color="#6a7080" wireframe transparent opacity={0.35} />
        </mesh>
      </group>
    );
  }

  if (slot.kind === "vehicle") {
    return (
      <group
        name={`cod-gltf-slot-dev-${slot.id}`}
        position={slot.position}
        rotation={rotation}
        userData={{ codAssetSlotDev: slot.id, codAssetKind: slot.kind }}
      >
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[1.9, 0.5, 4.2]} />
          <meshBasicMaterial color="#c27b3d" wireframe transparent opacity={0.5} />
        </mesh>
      </group>
    );
  }

  if (slot.kind === "prop") {
    return (
      <group
        name={`cod-gltf-slot-dev-${slot.id}`}
        position={slot.position}
        rotation={rotation}
        userData={{ codAssetSlotDev: slot.id, codAssetKind: slot.kind }}
      >
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[1.2, 0.08, 0.42]} />
          <meshBasicMaterial color="#6a5a48" wireframe transparent opacity={0.4} />
        </mesh>
        <mesh position={[0, 0.48, -0.18]}>
          <boxGeometry args={[1.2, 0.42, 0.06]} />
          <meshBasicMaterial color="#6a5a48" wireframe transparent opacity={0.4} />
        </mesh>
        <mesh position={[-0.52, 0.22, 0]}>
          <boxGeometry args={[0.06, 0.44, 0.06]} />
          <meshBasicMaterial color="#6a5a48" wireframe transparent opacity={0.4} />
        </mesh>
        <mesh position={[0.52, 0.22, 0]}>
          <boxGeometry args={[0.06, 0.44, 0.06]} />
          <meshBasicMaterial color="#6a5a48" wireframe transparent opacity={0.4} />
        </mesh>
      </group>
    );
  }

  if (slot.kind === "pedestrian") {
    const meshUserData = raycastId ? { codSubjectId: raycastId } : undefined;
    return (
      <group
        name={`cod-gltf-slot-dev-${slot.id}`}
        rotation={rotation}
        userData={{ codAssetSlotDev: slot.id, codAssetKind: slot.kind, codSubjectId: raycastId }}
      >
        <mesh position={[0, 0.95, 0]} userData={meshUserData}>
          <boxGeometry args={[0.45, 1.1, 0.28]} />
          <meshBasicMaterial color="#8a9ab0" wireframe transparent opacity={0.45} />
        </mesh>
        <mesh position={[0, 1.62, 0]} userData={meshUserData}>
          <sphereGeometry args={[0.14, 10, 10]} />
          <meshBasicMaterial color="#8a9ab0" wireframe transparent opacity={0.45} />
        </mesh>
      </group>
    );
  }

  return (
    <group
      name={`cod-gltf-slot-dev-${slot.id}`}
      position={slot.position}
      rotation={rotation}
      userData={{ codAssetSlotDev: slot.id, codAssetKind: slot.kind }}
    >
      <mesh>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshBasicMaterial color="#c27b3d" wireframe />
      </mesh>
    </group>
  );
}
