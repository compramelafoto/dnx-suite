"use client";

import { loadingGate } from "@/lib/simulator/loading-gate";
import { figureUrl, type FigureSpec } from "@/lib/simulator/studio-light/figures";
import * as THREE from "three";
import type { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Personas de la calle (avatares Rocketbox): lo que comparten los peatones y
 * quienes andan en bici, monopatín o moto.
 */

/** Devuelve una textura vacía en lugar de pedir el archivo. */
class EmptyTextureLoader extends THREE.Loader<THREE.Texture> {
  load(): THREE.Texture {
    return new THREE.Texture();
  }
}

/** Para `useLoader(FBXLoader, …, prepareAvatarLoader)`. */
export function prepareAvatarLoader(loader: FBXLoader) {
  // El FBX menciona texturas .tga que no se publican: se reemplazan en dressAvatar.
  const manager = new THREE.LoadingManager();
  loadingGate.track(manager);
  manager.addHandler(/\.tga$/i, new EmptyTextureLoader());
  loader.manager = manager;
}

export function avatarUrl(figure: FigureSpec): string {
  return figureUrl(figure, "model-facial.fbx");
}

/** Materiales del avatar (versión liviana de los del estudio: sin oclusión horneada). */
function dressAvatar(model: THREE.Object3D, figure: FigureSpec, cache: Map<string, THREE.Material>) {
  const loader = new THREE.TextureLoader();
  const tex = (file: string, color: boolean) => {
    const t = loader.load(figureUrl(figure, file));
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const materialFor = (name: string): THREE.Material => {
    const key = `${figure.folder}/${name}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const prefix = name.split("_")[0];
    const m = name.endsWith("_opacity")
      ? new THREE.MeshStandardMaterial({
          map: tex(`${prefix}_opacity_color.png`, true),
          alphaTest: 0.35,
          side: THREE.DoubleSide,
          roughness: 0.75,
        })
      : new THREE.MeshStandardMaterial({
          map: tex(`${prefix}_${name.endsWith("_head") ? "head" : "body"}_color.jpg`, true),
          normalMap: tex(`${prefix}_${name.endsWith("_head") ? "head" : "body"}_normal.jpg`, false),
          roughness: name.endsWith("_head") ? 0.55 : 0.8,
        });
    cache.set(key, m);
    return m;
  };
  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    // El FBX trae cinco niveles de detalle: en la calle alcanza el de máxima calidad.
    if (!mesh.name.includes("hipoly")) {
      mesh.visible = false;
      return;
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const rebuilt = mats.map((m) => materialFor(m.name));
    mesh.material = Array.isArray(mesh.material) ? rebuilt : rebuilt[0];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  });
}

/**
 * Copia del avatar vestida, a escala (metros) y con los pies en y = 0, dentro
 * de un grupo que mira a +Z. `subjectId` es el que usa el autofoco.
 */
export function instantiateAvatar(
  source: THREE.Group,
  figure: FigureSpec,
  cache: Map<string, THREE.Material>,
  subjectId: string,
): { root: THREE.Group; model: THREE.Object3D } {
  const model = cloneSkinned(source);
  // El FBX de Rocketbox trae una luz ambiente propia: con muchas personas iluminaba toda la calle.
  const strayLights: THREE.Object3D[] = [];
  model.traverse((o) => {
    if ((o as THREE.Light).isLight) strayLights.push(o);
  });
  for (const light of strayLights) light.removeFromParent();
  dressAvatar(model, figure, cache);
  model.scale.setScalar(0.01);
  const root = new THREE.Group();
  root.add(model);
  root.updateMatrixWorld(true);
  const feet = new THREE.Box3().setFromObject(model, true).min.y;
  model.position.y -= feet;
  model.traverse((o) => {
    o.userData.codSubjectId = subjectId;
  });
  return { root, model };
}
