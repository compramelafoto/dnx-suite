"use client";

import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import {
  planBuilding,
  planCorner,
  frontFrame,
  type PiecePlacement,
} from "@/lib/simulator/street/facade-plan";
import { STREET, type StreetLayout } from "@/lib/simulator/street/street-layout";
import { STREET_MODELS } from "@/lib/simulator/street/street-assets";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

interface KitPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/** Piezas del kit por nombre de nodo (una pieza puede tener varios materiales). */
function indexKit(root: THREE.Object3D): Map<string, KitPart[]> {
  const kit = new Map<string, KitPart[]>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Un nodo con varios materiales llega como grupo con mallas hijas.
    const owner = mesh.parent && mesh.parent !== root && !kit.has(mesh.name) ? mesh.parent.name : mesh.name;
    const name = owner || mesh.name;
    const parts = kit.get(name) ?? [];
    parts.push({ geometry: mesh.geometry, material: mesh.material as THREE.Material });
    kit.set(name, parts);
  });
  return kit;
}

const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _color = new THREE.Color();

/** Vidrio de las ventanas con luz: brilla cálido de noche (intensidad en useFrame). */
function litGlassFrom(glass: THREE.Material): THREE.MeshStandardMaterial {
  const base = glass as THREE.MeshStandardMaterial;
  const lit = base.clone();
  lit.emissive = new THREE.Color("#ffc985");
  lit.emissiveIntensity = 0;
  lit.transparent = false;
  lit.opacity = 1;
  return lit;
}

function buildInstances(
  kit: Map<string, KitPart[]>,
  placements: PiecePlacement[],
  litGlass: (glass: THREE.Material) => THREE.Material,
): THREE.InstancedMesh[] {
  const byPiece = new Map<string, PiecePlacement[]>();
  for (const p of placements) {
    const key = `${p.chunk}|${p.piece}${p.lit ? "#lit" : ""}`;
    const list = byPiece.get(key) ?? [];
    list.push(p);
    byPiece.set(key, list);
  }
  const meshes: THREE.InstancedMesh[] = [];
  for (const [key, list] of byPiece) {
    const piece = key.split("|")[1].replace("#lit", "");
    const lit = key.endsWith("#lit");
    const parts = kit.get(piece);
    if (!parts) {
      if (process.env.NODE_ENV === "development") console.warn("[Calle] pieza faltante", piece);
      continue;
    }
    for (const part of parts) {
      const isGlass = part.material.name.includes("glass");
      const material = lit && isGlass ? litGlass(part.material) : part.material;
      const inst = new THREE.InstancedMesh(part.geometry, material, list.length);
      const tinted = list.some((p) => p.tint);
      list.forEach((p, i) => {
        _pos.set(p.position[0], p.position[1], p.position[2]);
        _quat.setFromAxisAngle(_up, p.rotationY);
        inst.setMatrixAt(i, _matrix.compose(_pos, _quat, _scale));
        if (tinted) inst.setColorAt(i, _color.set(p.tint ?? "#ffffff"));
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.computeBoundingSphere();
      meshes.push(inst);
    }
  }
  return meshes;
}

interface Backdrop {
  material: THREE.MeshStandardMaterial;
}

/**
 * Interior detrás de las ventanas y volumen del edificio para los costados
 * y techos que asoman.
 */
/** Caja con UV en metros (una repetición cada 3 m), para revoque a escala real. */
function metricBox(width: number, height: number, depth: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  // Orden de caras de BoxGeometry: +x, −x, +y, −y, +z, −z (4 vértices cada una).
  const faceSize: [number, number][] = [
    [depth, height],
    [depth, height],
    [width, depth],
    [width, depth],
    [width, height],
    [width, height],
  ];
  faceSize.forEach(([w, h], face) => {
    // La cara de adelante (+z) es el interior oscuro: no lleva revoque.
    if (face === 4) return;
    for (let v = face * 4; v < face * 4 + 4; v += 1) uv.setXY(v, (uv.getX(v) * w) / 3, (uv.getY(v) * h) / 3);
  });
  return geo;
}

function buildBackdropsAndMasses(
  layout: StreetLayout,
  plasterBase: THREE.Material | undefined,
): { backdrops: Backdrop[]; masses: THREE.Mesh[] } {
  const backdrops: Backdrop[] = [];
  const masses: THREE.Mesh[] = [];
  const roof = new THREE.MeshStandardMaterial({ color: "#5d5a55", roughness: 0.95 });
  for (const b of layout.buildings) {
    const frame = frontFrame(b.start, b.end, b.normal);
    const height = b.floors * STREET.floorHeight;
    const group = new THREE.Group();
    group.position.set(frame.origin[0], 0, frame.origin[1]);
    group.rotation.y = frame.rotationY;

    // Interior oscuro detrás de las ventanas (las que tienen luz se encienden en el vidrio).
    const material = new THREE.MeshStandardMaterial({ color: "#16130f", roughness: 0.85 });
    // Medianeras y fondo con el mismo revoque del kit, teñido como la fachada.
    const plaster =
      plasterBase instanceof THREE.MeshStandardMaterial
        ? Object.assign(plasterBase.clone(), { color: new THREE.Color(b.tint) })
        : new THREE.MeshStandardMaterial({ color: b.tint, roughness: 0.92 });
    const depth = 12;
    // La cara de adelante (detrás de las ventanas) es el interior.
    const mass = new THREE.Mesh(metricBox(frame.length, height, depth), [
      plaster,
      plaster,
      roof,
      roof,
      material,
      plaster,
    ]);
    mass.position.set(frame.length / 2, height / 2, -0.3 - depth / 2);
    mass.castShadow = true;
    mass.receiveShadow = true;
    group.add(mass);
    group.updateMatrixWorld(true);
    masses.push(group as unknown as THREE.Mesh);
    backdrops.push({ material });
  }
  return { backdrops, masses };
}

/**
 * Edificios de la calle: piezas del kit instanciadas, interiores y volúmenes.
 * De noche se prenden algunas ventanas.
 */
export default function StreetBuildings({ layout }: { layout: StreetLayout }) {
  const gltf = useGLTF(STREET_MODELS.facadeKit);
  const kit = useMemo(() => indexKit(gltf.scene), [gltf.scene]);

  const litGlass = useMemo(() => {
    const cache = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const get = (glass: THREE.Material) => {
      const hit = cache.get(glass);
      if (hit) return hit;
      const made = litGlassFrom(glass);
      cache.set(glass, made);
      return made;
    };
    return { get, all: () => [...cache.values()] };
  }, []);

  const instances = useMemo(() => {
    const placements = [
      ...layout.buildings.flatMap(planBuilding),
      ...layout.corners.flatMap(planCorner),
    ];
    return buildInstances(kit, placements, litGlass.get);
  }, [kit, layout, litGlass]);

  const { backdrops, masses } = useMemo(
    () => buildBackdropsAndMasses(layout, kit.get("wall_standard_standard_01")?.[0]?.material),
    [layout, kit],
  );

  useEffect(
    () => () => {
      for (const m of instances) m.dispose();
      for (const b of backdrops) {
        b.material.dispose();
      }
    },
    [instances, backdrops],
  );

  // Las ventanas se prenden al caer el sol.
  useFrame(() => {
    const sun = simulatorRuntime.sunState;
    const night = THREE.MathUtils.clamp((4 - sun.elevationDeg) / 10, 0, 1);
    for (const g of litGlass.all()) g.emissiveIntensity = night * 2.2;
  });

  return (
    <group>
      {instances.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
      {masses.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </group>
  );
}

useGLTF.preload(STREET_MODELS.facadeKit);
