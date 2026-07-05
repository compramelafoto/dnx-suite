/**
 * Preparación de escenas glTF cargadas — sombras, PBR, bounding box.
 */

import type { PhotographicAssetSlot } from "./photographic-block-manifest";
import * as THREE from "three";

export interface GltfSceneStats {
  meshCount: number;
  materialCount: number;
  boundingBox: THREE.Box3;
}

function resolveScaleVector(
  scale: PhotographicAssetSlot["scale"],
): THREE.Vector3 {
  if (scale == null) return new THREE.Vector3(1, 1, 1);
  if (typeof scale === "number") return new THREE.Vector3(scale, scale, scale);
  return new THREE.Vector3(scale[0], scale[1], scale[2]);
}

/**
 * Aplica sombras y conserva materiales PBR originales (sin sobrescribir).
 */
export function prepareGltfScene(
  root: THREE.Object3D,
  slot: PhotographicAssetSlot,
): GltfSceneStats {
  const boundingBox = new THREE.Box3();
  const materials = new Set<THREE.Material>();
  let meshCount = 0;

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    meshCount++;
    obj.castShadow = slot.castShadow;
    obj.receiveShadow = slot.receiveShadow;
    obj.frustumCulled = true;

    const meshMaterials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of meshMaterials) {
      if (!material) continue;
      materials.add(material);
      if (material instanceof THREE.MeshStandardMaterial) {
        material.needsUpdate = true;
      }
    }

    boundingBox.expandByObject(obj);
  });

  if (slot.groundAlign && !boundingBox.isEmpty()) {
    const offsetY = boundingBox.min.y;
    root.position.y -= offsetY;
    boundingBox.translate(new THREE.Vector3(0, -offsetY, 0));
  }

  return {
    meshCount,
    materialCount: materials.size,
    boundingBox,
  };
}

export function formatBoundingBox(box: THREE.Box3): {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
} {
  const size = new THREE.Vector3();
  box.getSize(size);
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
    size: [size.x, size.y, size.z],
  };
}

export function applySlotTransform(
  root: THREE.Object3D,
  slot: PhotographicAssetSlot,
): void {
  root.position.set(slot.position[0], slot.position[1], slot.position[2]);

  if (slot.rotation) {
    root.rotation.set(slot.rotation[0], slot.rotation[1], slot.rotation[2]);
  } else {
    root.rotation.set(0, slot.rotationY ?? 0, 0);
  }

  const scaleVec = resolveScaleVector(slot.scale);
  root.scale.copy(scaleVec);
}
