"use client";

import { STREET_CARS, streetCarUrl, type StreetCarModel } from "@/lib/simulator/street/street-cars";
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

/** Auto listo para clonar: frente a +Z, apoyado en y = 0, centrado y a escala real. */
export interface StreetCarPrototype {
  model: StreetCarModel;
  object: THREE.Object3D;
  width: number;
  height: number;
}

const URLS = STREET_CARS.map(streetCarUrl);

/** Caja de las mallas visibles (algunos modelos traen un plano de sombra horneada). */
function visibleBox(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh) box.union(new THREE.Box3().setFromObject(o, true));
  });
  return box;
}

function normalize(source: THREE.Object3D, model: StreetCarModel): StreetCarPrototype {
  const inner = source.clone(true);
  inner.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (/shadow/i.test(mesh.name)) {
      mesh.visible = false;
      return;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  inner.rotation.y = THREE.MathUtils.degToRad(model.yawDeg);
  const holder = new THREE.Group();
  holder.add(inner);
  const box = visibleBox(holder);
  const scale = model.lengthM / (box.max.z - box.min.z);
  // Escala uniforme alrededor del origen: la caja escala igual.
  inner.scale.multiplyScalar(scale);
  const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
  inner.position.set(-center.x, -box.min.y * scale, -center.z);
  return {
    model,
    object: holder,
    width: (box.max.x - box.min.x) * scale,
    height: (box.max.y - box.min.y) * scale,
  };
}

/** Los autos de la calle, en el orden de STREET_CARS. */
export function useStreetCars(): StreetCarPrototype[] {
  const gltfs = useGLTF(URLS);
  return useMemo(() => gltfs.map((g, i) => normalize(g.scene, STREET_CARS[i])), [gltfs]);
}

/** Copia de un auto (comparte geometría y materiales con el original). */
export function cloneCar(proto: StreetCarPrototype): THREE.Object3D {
  return proto.object.clone(true);
}

for (const url of URLS) useGLTF.preload(url);
