"use client";

import * as THREE from "three";

/**
 * Pisos que se mojan con la lluvia: más oscuros y más brillantes (el agua
 * llena los poros y refleja). Los materiales de calle y vereda se anotan acá.
 */
const surfaces = new Set<THREE.MeshStandardMaterial>();
let current = 0;

export function registerWetSurface(material: THREE.MeshStandardMaterial): () => void {
  surfaces.add(material);
  apply(material, current);
  return () => surfaces.delete(material);
}

function apply(material: THREE.MeshStandardMaterial, wet: number) {
  // roughness multiplica al mapa de rugosidad: mojado brilla mucho más.
  material.roughness = 1 - 0.62 * wet;
  material.color.setScalar(1 - 0.38 * wet);
}

/** 0 = seco, 1 = empapado. Sólo trabaja cuando cambia. */
export function setGroundWetness(wet: number) {
  if (Math.abs(wet - current) < 0.002) return;
  current = wet;
  for (const m of surfaces) apply(m, wet);
}
