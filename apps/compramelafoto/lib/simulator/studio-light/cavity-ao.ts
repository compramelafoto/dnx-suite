/**
 * Oclusión de cavidades por vértice (fosas nasales, orejas, comisuras).
 *
 * Las sombras en tiempo real no resuelven huecos de pocos milímetros y las
 * luces de área no proyectan sombra: sin esto, la luz "entra" en la nariz.
 * Para cada vértice medimos cuánta superficie vecina queda delante de su
 * normal dentro de un radio corto; cuanto más rodeado, más oscuro.
 * El resultado se guarda como color de vértice (multiplica el color de la piel).
 */

import * as THREE from "three";

export interface CavityOptions {
  /** Radio de búsqueda en unidades de la geometría. */
  radius: number;
  /** Cuánto oscurecen las cavidades (0–3). */
  strength?: number;
  /** Valor mínimo (nunca negro absoluto). */
  floor?: number;
}

/** Devuelve el factor de oclusión por vértice (1 = sin oclusión). */
export function computeCavityAO(
  positions: ArrayLike<number>,
  normals: ArrayLike<number>,
  { radius, strength = 1.7, floor = 0.22 }: CavityOptions,
): Float32Array {
  const count = positions.length / 3;
  const cell = radius;
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;

  for (let i = 0; i < count; i++) {
    const k = key(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    let bucket = grid.get(k);
    if (!bucket) grid.set(k, (bucket = []));
    bucket.push(i);
  }

  const out = new Float32Array(count);
  const r2 = radius * radius;
  const minD2 = (radius * 0.04) ** 2;
  for (let i = 0; i < count; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const cx = Math.floor(px / cell);
    const cy = Math.floor(py / cell);
    const cz = Math.floor(pz / cell);
    let occluded = 0;
    let weight = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!bucket) continue;
          for (const j of bucket) {
            const vx = positions[j * 3] - px;
            const vy = positions[j * 3 + 1] - py;
            const vz = positions[j * 3 + 2] - pz;
            const d2 = vx * vx + vy * vy + vz * vz;
            // Fuera del radio, o el mismo punto repetido en una costura de UV.
            if (d2 > r2 || d2 < minD2) continue;
            const d = Math.sqrt(d2);
            const w = 1 - d / radius;
            const facing = (vx * nx + vy * ny + vz * nz) / d;
            if (facing > 0) occluded += facing * w;
            weight += w;
          }
        }
      }
    }
    const occlusion = weight > 0 ? occluded / weight : 0;
    out[i] = Math.max(floor, 1 - strength * occlusion);
  }
  return out;
}

/** Hornea la oclusión en el atributo `color` de la geometría (una sola vez). */
export function bakeCavityAO(geometry: THREE.BufferGeometry, options: CavityOptions): void {
  if (geometry.userData.cavityAO) return;
  const pos = geometry.getAttribute("position");
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const nor = geometry.getAttribute("normal");
  if (!pos || !nor) return;
  const ao = computeCavityAO(pos.array as ArrayLike<number>, nor.array as ArrayLike<number>, options);
  const colors = new Float32Array(ao.length * 3);
  for (let i = 0; i < ao.length; i++) {
    colors[i * 3] = ao[i];
    // Las cavidades de la piel no son grises: la luz que rebota adentro es rojiza.
    colors[i * 3 + 1] = ao[i] * (0.92 + 0.08 * ao[i]);
    colors[i * 3 + 2] = ao[i] * (0.88 + 0.12 * ao[i]);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.userData.cavityAO = true;
}
