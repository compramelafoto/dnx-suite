/**
 * Aplica pesos de expresión a la malla de un avatar Rocketbox "_facial".
 */

import * as THREE from "three";
import { FACE_SHAPES, type FaceShape, type FaceWeights } from "./face-expressions";

/** El FBX nombra las formas "blendShape1.AK_09_EyeBlinkLeft". */
function shapeName(key: string): string {
  return key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : key;
}

/**
 * Deja sólo las formas que usamos (de 175 a 44): las otras ocupan memoria de
 * video por cada vértice. Se hace una vez sobre el modelo original, antes de
 * clonarlo; los clones comparten la geometría ya recortada.
 */
export function pruneFaceShapes(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || mesh.userData.facePruned) return;
    const geo = mesh.geometry;
    const byName = new Map<string, number>();
    for (const [key, index] of Object.entries(mesh.morphTargetDictionary)) byName.set(shapeName(key), index);
    const keep = FACE_SHAPES.filter((s) => byName.has(s));
    for (const attr of ["position", "normal"] as const) {
      const list = geo.morphAttributes[attr];
      if (!list) continue;
      geo.morphAttributes[attr] = keep.map((s) => {
        const a = list[byName.get(s)!];
        a.name = s;
        return a;
      });
    }
    mesh.updateMorphTargets();
    mesh.userData.facePruned = true;
  });
}

/** Malla con formas de cara de un avatar ya clonado. */
export function findFaceMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!found && mesh.isMesh && mesh.visible && mesh.morphTargetDictionary && "AK_09_EyeBlinkLeft" in mesh.morphTargetDictionary) {
      found = mesh;
    }
  });
  return found;
}

/** Escribe los pesos (lo que no figura queda en 0). */
export function applyFaceWeights(mesh: THREE.Mesh, weights: FaceWeights): void {
  const dict = mesh.morphTargetDictionary;
  const influences = mesh.morphTargetInfluences;
  if (!dict || !influences) return;
  influences.fill(0);
  for (const [k, v] of Object.entries(weights) as [FaceShape, number][]) {
    const i = dict[k];
    if (i !== undefined) influences[i] = v;
  }
}
