/**
 * Punto de enfoque preferente para peatones glTF — rostro/cabeza.
 */

import * as THREE from "three";

const HEAD_NODE_PATTERNS = [
  /^head$/i,
  /head$/i,
  /^face$/i,
  /mixamorighead/i,
  /mixamorig:head/i,
  /neck.*head/i,
  /bip01.*head/i,
];

export type PedestrianFocusSource = "head" | "bbox";

export interface PedestrianFocusResolveResult {
  localOffset: THREE.Vector3;
  source: PedestrianFocusSource;
  headNodeName: string | null;
}

export function findPedestrianHeadNode(root: THREE.Object3D): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (found) return;
    const name = obj.name;
    if (!name) return;
    if (HEAD_NODE_PATTERNS.some((pattern) => pattern.test(name))) {
      found = obj;
    }
  });
  return found;
}

/**
 * Calcula offset local al rostro (nodo cabeza o 85 % altura del bbox).
 */
export function resolvePedestrianFocusOffset(
  model: THREE.Object3D,
  boundingBox: THREE.Box3,
): PedestrianFocusResolveResult {
  const headNode = findPedestrianHeadNode(model);

  if (headNode) {
    const world = new THREE.Vector3();
    headNode.getWorldPosition(world);
    const localOffset = model.worldToLocal(world.clone());
    return {
      localOffset,
      source: "head",
      headNodeName: headNode.name,
    };
  }

  const localOffset = new THREE.Vector3();
  if (!boundingBox.isEmpty()) {
    localOffset.set(
      (boundingBox.min.x + boundingBox.max.x) / 2,
      boundingBox.min.y + (boundingBox.max.y - boundingBox.min.y) * 0.85,
      (boundingBox.min.z + boundingBox.max.z) / 2,
    );
  } else {
    localOffset.set(0, 1.65, 0);
  }

  return {
    localOffset,
    source: "bbox",
    headNodeName: null,
  };
}

export function pedestrianFocusWorldPosition(
  group: THREE.Object3D,
  localOffset: THREE.Vector3,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  return target.copy(localOffset).applyMatrix4(group.matrixWorld);
}
