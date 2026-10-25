"use client";

import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { planBuilding, planCorner, frontFrame, type PiecePlacement } from "@/lib/simulator/street/facade-plan";
import { STREET, type CityBlock, type StreetLayout, type Vec2 } from "@/lib/simulator/street/street-layout";
import { STREET_MODELS } from "@/lib/simulator/street/street-assets";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

interface KitPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/**
 * Piezas del kit por nombre de nodo (una pieza puede tener varios materiales).
 * `materialsFrom`: la versión simplificada viene sin texturas y usa los
 * materiales de la completa (mismo nombre).
 */
function indexKit(root: THREE.Object3D, materialsFrom?: Map<string, THREE.Material>): Map<string, KitPart[]> {
  const kit = new Map<string, KitPart[]>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Un nodo con varios materiales llega como grupo con mallas hijas.
    const owner = mesh.parent && mesh.parent !== root && !kit.has(mesh.name) ? mesh.parent.name : mesh.name;
    const name = owner || mesh.name;
    const parts = kit.get(name) ?? [];
    const own = mesh.material as THREE.Material;
    parts.push({ geometry: mesh.geometry, material: materialsFrom?.get(own.name) ?? own });
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

/** Hasta dónde se dibuja la fachada con el kit (m); más allá, el volumen con ventanas pintadas. */
const DETAIL_DISTANCE = 60;
/**
 * Más cerca que esto, el kit con todo su detalle; entre esto y DETAIL_DISTANCE,
 * el kit simplificado (29 % de los triángulos): de lejos no se distingue y
 * eran millones de triángulos por cuadro.
 */
const FULL_DETAIL_DISTANCE = 22;
/** Más allá de esto la manzana no se dibuja (queda en la bruma). */
const DRAW_DISTANCE = 200;
/** Fondo de los edificios (m). */
const DEPTH = 12;

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

/** Una fachada (un lado de manzana u ochava): sus piezas y dónde mira. */
interface FacadeSide {
  group: THREE.Group;
  /** Las mismas piezas, simplificadas (se usa de lejos). */
  lod: THREE.Group;
  min: Vec2;
  max: Vec2;
  /** Hacia dónde mira la fachada (hacia la calle). */
  facing: Vec2;
}

type Placement = PiecePlacement & { facing: Vec2 };

/** Piezas del kit instanciadas, agrupadas por fachada (manzana:lado). */
function buildInstances(
  kit: Map<string, KitPart[]>,
  placements: Placement[],
  litGlass: (glass: THREE.Material) => THREE.Material,
): Map<string, FacadeSide> {
  const byPiece = new Map<string, Placement[]>();
  for (const p of placements) {
    const key = `${p.chunk}|${p.piece}${p.lit ? "#lit" : ""}`;
    const list = byPiece.get(key) ?? [];
    list.push(p);
    byPiece.set(key, list);
  }
  const out = new Map<string, FacadeSide>();
  const sideFor = (chunk: string, list: Placement[]) => {
    let side = out.get(chunk);
    if (!side) {
      side = { group: new THREE.Group(), lod: new THREE.Group(), min: [Infinity, Infinity], max: [-Infinity, -Infinity], facing: list[0].facing };
      out.set(chunk, side);
    }
    for (const p of list) {
      side.min = [Math.min(side.min[0], p.position[0]), Math.min(side.min[1], p.position[2])];
      side.max = [Math.max(side.max[0], p.position[0]), Math.max(side.max[1], p.position[2])];
    }
    return side;
  };
  for (const [key, list] of byPiece) {
    const [chunk, raw] = key.split("|");
    const piece = raw.replace("#lit", "");
    const lit = raw.endsWith("#lit");
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
      // La sombra la da el volumen del edificio: las molduras del kit no se dibujan otra vez en el mapa de sombras.
      inst.castShadow = false;
      inst.receiveShadow = true;
      inst.computeBoundingSphere();
      sideFor(chunk, list).group.add(inst);
    }
  }
  return out;
}

/** Caja a juntar en un volumen: dónde va, de qué color y qué tiene en la cara de adelante. */
interface MassBox {
  origin: Vec2;
  rotationY: number;
  length: number;
  height: number;
  depth: number;
  /** Corrimiento hacia atrás de la cara de adelante (m). */
  inset: number;
  tint: string;
  /** La cara de adelante es fachada (el kit adelante, o ventanas pintadas de lejos). */
  facade: boolean;
}

const ROOF = new THREE.Color("#5d5a55");
const INTERIOR = new THREE.Color("#16130f");

/**
 * Junta las cajas de una manzana en una geometría con tres grupos:
 * revoque (costados y fondo), techo y frente. `farFront` decide el frente:
 * interior oscuro (detrás del kit) o fachada pintada (de lejos).
 */
function mergeMasses(boxes: MassBox[], farFront: boolean): THREE.BufferGeometry {
  const buckets = [0, 1, 2].map(() => ({ pos: [] as number[], nor: [] as number[], uv: [] as number[], col: [] as number[] }));
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  for (const b of boxes) {
    const geo = new THREE.BoxGeometry(b.length, b.height, b.depth);
    const m = new THREE.Matrix4().makeRotationY(b.rotationY);
    m.multiply(new THREE.Matrix4().makeTranslation(b.length / 2, b.height / 2, -b.inset - b.depth / 2));
    m.premultiply(new THREE.Matrix4().makeTranslation(b.origin[0], 0, b.origin[1]));
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(m);
    const pos = geo.getAttribute("position");
    const nor = geo.getAttribute("normal");
    const uv = geo.getAttribute("uv");
    const index = geo.getIndex()!;
    // Caras de BoxGeometry: +x, −x, +y, −y, +z, −z; las medidas para que la textura vaya en metros.
    const faceSize: [number, number][] = [
      [b.depth, b.height],
      [b.depth, b.height],
      [b.length, b.depth],
      [b.length, b.depth],
      [b.length, b.height],
      [b.length, b.height],
    ];
    geo.groups.forEach((g, face) => {
      const isFront = face === 4 && b.facade;
      const bucket = face === 2 || face === 3 ? 1 : isFront ? 2 : 0;
      if (bucket === 1) c.copy(ROOF);
      else if (isFront && !farFront) c.copy(INTERIOR);
      else c.set(b.tint);
      for (let k = g.start; k < g.start + g.count; k += 1) {
        const i = index.getX(k);
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
        const t = buckets[bucket];
        t.pos.push(v.x, v.y, v.z);
        t.nor.push(n.x, n.y, n.z);
        t.uv.push((uv.getX(i) * faceSize[face][0]) / 3, (uv.getY(i) * faceSize[face][1]) / 3);
        t.col.push(c.r, c.g, c.b);
      }
    });
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  const all = { pos: [] as number[], nor: [] as number[], uv: [] as number[], col: [] as number[] };
  let start = 0;
  buckets.forEach((t, gi) => {
    all.pos.push(...t.pos);
    all.nor.push(...t.nor);
    all.uv.push(...t.uv);
    all.col.push(...t.col);
    out.addGroup(start, t.pos.length / 3, gi);
    start += t.pos.length / 3;
  });
  out.setAttribute("position", new THREE.Float32BufferAttribute(all.pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(all.nor, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(all.uv, 2));
  out.setAttribute("color", new THREE.Float32BufferAttribute(all.col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Fachada pintada de un módulo de 3 × 3 m (para ver de lejos): revoque claro y una ventana. */
function windowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#d9d6cf";
  g.fillRect(0, 118, 128, 10);
  g.fillStyle = "#2a3038";
  g.fillRect(36, 26, 56, 70);
  g.fillStyle = "#4b5663";
  g.fillRect(40, 30, 22, 62);
  g.fillStyle = "#e9e4da";
  g.fillRect(30, 96, 68, 6);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Distancia (en planta) de un punto a la manzana. */
function distanceToBlock(b: CityBlock, x: number, z: number): number {
  const dx = Math.max(b.x0 - x, 0, x - b.x1);
  const dz = Math.max(b.z0 - z, 0, z - b.z1);
  return Math.hypot(dx, dz);
}

interface BlockGroup {
  block: CityBlock;
  near: THREE.Group;
  far: THREE.Group;
  /** Fachadas con el kit: cada una se prende sólo si está cerca y mirando hacia la cámara. */
  sides: FacadeSide[];
  masses: THREE.BufferGeometry[];
}

/** Distancia (en planta) de un punto a la caja de una fachada. */
function distanceToSide(side: FacadeSide, x: number, z: number): number {
  const dx = Math.max(side.min[0] - x, 0, x - side.max[0]);
  const dz = Math.max(side.min[1] - z, 0, z - side.max[1]);
  return Math.hypot(dx, dz);
}

/**
 * ¿La cámara está del lado de la calle de esta fachada? Si está detrás, el
 * volumen del edificio la tapa: dibujar sus molduras era trabajo perdido.
 * Margen de 2 m para que no se apague justo al pasar por la esquina.
 */
function facesCamera(side: FacadeSide, x: number, z: number): boolean {
  const cx = (side.min[0] + side.max[0]) / 2;
  const cz = (side.min[1] + side.max[1]) / 2;
  return (x - cx) * side.facing[0] + (z - cz) * side.facing[1] > -2;
}

/**
 * Edificios de toda la ciudad, agrupados por manzana: de cerca las piezas del
 * kit, de lejos el volumen con ventanas pintadas, y más lejos nada. De noche
 * se prenden algunas ventanas.
 */
export default function StreetBuildings({ layout }: { layout: StreetLayout }) {
  const camera = useThree((s) => s.camera);
  const gltf = useGLTF(STREET_MODELS.facadeKit);
  const gltfLod = useGLTF(STREET_MODELS.facadeKitLod);
  const kit = useMemo(() => indexKit(gltf.scene), [gltf.scene]);
  const kitLod = useMemo(() => {
    const byName = new Map<string, THREE.Material>();
    gltf.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && !Array.isArray(m)) byName.set(m.name, m);
    });
    return indexKit(gltfLod.scene, byName);
  }, [gltf.scene, gltfLod.scene]);

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

  const materials = useMemo(() => {
    const base = kit.get("wall_standard_standard_01")?.[0]?.material;
    const plaster =
      base instanceof THREE.MeshStandardMaterial
        ? Object.assign(base.clone(), { vertexColors: true, color: new THREE.Color("#ffffff") })
        : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    const roof = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const interior = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const windows = windowTexture();
    const painted = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: windows,
      roughness: 0.8,
      emissive: new THREE.Color("#ffc985"),
      emissiveMap: windows,
      emissiveIntensity: 0,
    });
    return { near: [plaster, roof, interior], far: [plaster, roof, painted], painted };
  }, [kit]);

  const groups = useMemo(() => {
    // Una malla por pieza y por lado de manzana: lo que queda fuera de cuadro se descarta entero.
    const placements: Placement[] = [
      ...layout.buildings.flatMap((b) => planBuilding(b).map((p) => ({ ...p, chunk: `${b.chunk}:${b.id.replace(/-\d+$/, "")}`, facing: b.normal }))),
      ...layout.corners.flatMap((c) => planCorner(c).map((p) => ({ ...p, chunk: `${c.chunk}:ochava-${c.onMain[0]}-${c.onCross[1]}`, facing: c.normal }))),
    ];
    const sides = buildInstances(kit, placements, litGlass.get);
    // La versión simplificada, con las mismas fachadas: cada lado guarda las dos.
    for (const [chunk, simple] of buildInstances(kitLod, placements, litGlass.get)) {
      const side = sides.get(chunk);
      if (side) side.lod = simple.group;
    }
    const boxesByBlock = new Map<string, MassBox[]>();
    const add = (chunk: string, box: MassBox) => boxesByBlock.set(chunk, [...(boxesByBlock.get(chunk) ?? []), box]);
    for (const b of layout.buildings) {
      const frame = frontFrame(b.start, b.end, b.normal);
      add(b.chunk, { origin: frame.origin, rotationY: frame.rotationY, length: frame.length, height: b.floors * STREET.floorHeight, depth: DEPTH, inset: 0.3, tint: b.tint, facade: true });
    }
    for (const w of layout.walls) {
      const frame = frontFrame(w.start, w.end, w.normal);
      add(w.chunk, { origin: frame.origin, rotationY: frame.rotationY, length: frame.length, height: w.height, depth: w.thickness, inset: 0, tint: w.tint, facade: false });
    }
    const out: BlockGroup[] = [];
    for (const block of layout.blocks) {
      const boxes = boxesByBlock.get(block.id);
      if (!boxes) continue;
      const near = new THREE.Group();
      const blockSides = [...sides.entries()].filter(([chunk]) => chunk.split(":")[0] === block.id).map(([, side]) => side);
      for (const side of blockSides) near.add(side.group, side.lod);
      const nearMass = new THREE.Mesh(mergeMasses(boxes, false), materials.near);
      nearMass.castShadow = true;
      nearMass.receiveShadow = true;
      near.add(nearMass);
      const far = new THREE.Group();
      const farMass = new THREE.Mesh(mergeMasses(boxes, true), materials.far);
      farMass.castShadow = true;
      farMass.receiveShadow = true;
      far.add(farMass);
      out.push({ block, near, far, sides: blockSides, masses: [nearMass.geometry, farMass.geometry] });
    }
    return out;
  }, [kit, kitLod, layout, litGlass, materials]);

  useEffect(
    () => () => {
      // Sólo los volúmenes son propios: las piezas del kit se comparten con el modelo cargado.
      for (const g of groups) for (const m of g.masses) m.dispose();
    },
    [groups],
  );

  // Las ventanas se prenden al caer el sol; cada ~0,2 s se decide qué manzanas se ven y cómo.
  const tick = useRef(0);
  useFrame((_, delta) => {
    const sun = simulatorRuntime.sunState;
    const night = THREE.MathUtils.clamp((4 - sun.elevationDeg) / 10, 0, 1);
    for (const g of litGlass.all()) g.emissiveIntensity = night * 2.2;
    materials.painted.emissiveIntensity = night * 0.25;
    tick.current -= delta;
    if (tick.current > 0) return;
    tick.current = 0.2;
    const { x, z } = camera.position;
    for (const g of groups) {
      const d = distanceToBlock(g.block, x, z);
      g.near.visible = d < DETAIL_DISTANCE;
      g.far.visible = !g.near.visible && d < DRAW_DISTANCE;
      if (!g.near.visible) continue;
      // Sólo se apagan las que dan la espalda: una de frente sin kit mostraría el
      // frente oscuro del volumen (el que va detrás de las piezas).
      for (const side of g.sides) {
        const facing = facesCamera(side, x, z);
        const close = distanceToSide(side, x, z) < FULL_DETAIL_DISTANCE;
        side.group.visible = facing && close;
        side.lod.visible = facing && !close;
      }
    }
  });

  return (
    <group name="calle-edificios">
      {groups.map((g) => (
        <group key={g.block.id}>
          <primitive object={g.near} />
          <primitive object={g.far} />
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(STREET_MODELS.facadeKit);
useGLTF.preload(STREET_MODELS.facadeKitLod);
