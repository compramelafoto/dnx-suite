"use client";

import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { STREET_MODELS } from "@/lib/simulator/street/street-assets";
import { STREET_CARS, streetCarFor } from "@/lib/simulator/street/street-cars";
import type { PropKind, StreetLayout, StreetProp } from "@/lib/simulator/street/street-layout";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { makeImpostor, type Impostor } from "./impostor";
import { useStreetCars } from "./street-car-models";

/** Los autos estacionados se dibujan con los modelos de autos (ver street-car-models). */
type ModelKind = Exclude<PropKind, "car">;

const MODEL_BY_KIND: Record<ModelKind, string> = {
  lamp: STREET_MODELS.lamp,
  tree: STREET_MODELS.tree,
  trash: STREET_MODELS.trash,
  hydrant: STREET_MODELS.hydrant,
  bench: STREET_MODELS.bench,
  utility: STREET_MODELS.utility,
  manhole: STREET_MODELS.manhole,
  plant: STREET_MODELS.plant,
  aircon: STREET_MODELS.aircon,
  "covered-car": STREET_MODELS.coveredCar,
  statue: STREET_MODELS.statue,
  "plaza-lamp": STREET_MODELS.plazaLamp,
  "plaza-bench": STREET_MODELS.plazaBench,
  shrub: STREET_MODELS.shrub,
  "coffee-cart": STREET_MODELS.coffeeCart,
  "cafe-table": STREET_MODELS.cafeTable,
  monobloc: STREET_MODELS.monobloc,
  crate: STREET_MODELS.crate,
  trashbag: STREET_MODELS.trashbag,
  cardboard: STREET_MODELS.cardboard,
  barrel: STREET_MODELS.barrel,
  "wall-lamp": STREET_MODELS.wallLamp,
  cables: STREET_MODELS.cables,
  "shutter-door": STREET_MODELS.shutterDoor,
  planter: STREET_MODELS.planter,
  rat: STREET_MODELS.rat,
};

interface KindSpec {
  /** Escala del modelo (el jacarandá es de parque; la estatua viene en miniatura). */
  scale?: number;
  /** Hasta dónde se dibuja el modelo completo (m). */
  near: number;
  /** Hasta dónde se dibuja algo (m); entre `near` y esto, el impostor. */
  draw: number;
  /**
   * Con impostor: sólo los `pool` más cercanos (a menos de `near`) van con el
   * modelo completo; los demás son la foto sobre dos planos.
   */
  impostor?: boolean;
  pool?: number;
  shadow?: boolean;
}

/** Cosas chicas: de lejos no se ven y no vale la pena dibujarlas. */
const SMALL: KindSpec = { near: 55, draw: 55 };

const SPEC: Partial<Record<PropKind, KindSpec>> = {
  lamp: { near: 30, draw: 190, impostor: true, pool: 10, shadow: true },
  tree: { scale: 0.62, near: 22, draw: 190, impostor: true, pool: 4, shadow: true },
  "plaza-lamp": { scale: 2.2, near: 25, draw: 150, impostor: true, pool: 6, shadow: true },
  statue: { scale: 15, near: 400, draw: 400, shadow: true },
  shrub: { scale: 1.4, near: 70, draw: 90 },
  cables: { scale: 2.9, near: 80, draw: 80 },
  car: { near: 70, draw: 70, shadow: true },
  "covered-car": { near: 70, draw: 70, shadow: true },
  "coffee-cart": { near: 90, draw: 90, shadow: true },
  "shutter-door": { near: 90, draw: 90 },
  manhole: { near: 60, draw: 60 },
  utility: { near: 70, draw: 70, shadow: true },
  bench: { near: 70, draw: 70, shadow: true },
  "plaza-bench": { near: 70, draw: 70, shadow: true },
};

const BRONZE = new THREE.MeshStandardMaterial({ color: "#5c4327", metalness: 0.85, roughness: 0.42 });

/** Lado de cada grupo de dibujo (m): lo que queda lejos se apaga por grupo. */
const CHUNK = 40;
/** Luces reales encendidas a la vez (las demás sólo brillan): cuidan el rendimiento. */
const ACTIVE_LAMP_LIGHTS = 12;
/** Altura de la luminaria del farol de calle (m) y largo de su brazo. */
const LAMP_HEAD_HEIGHT = 5.6;
const LAMP_ARM = 1.1;
/** Farol de plaza: la luz va arriba del poste. */
const PLAZA_LAMP_HEAD = 3.5;

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrix: THREE.Matrix4;
}

/** Mallas de un modelo con su transformación relativa a la raíz. */
export function flattenParts(root: THREE.Object3D): Part[] {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const parts: Part[] = [];
  root.traverseVisible((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.length > 1) {
      // Mallas con varios materiales: una parte por grupo.
      for (const g of mesh.geometry.groups) {
        const geo = mesh.geometry.clone();
        geo.clearGroups();
        geo.setDrawRange(g.start, g.count);
        parts.push({ geometry: geo, material: materials[g.materialIndex ?? 0], matrix: inv.clone().multiply(mesh.matrixWorld) });
      }
      return;
    }
    parts.push({ geometry: mesh.geometry, material: materials[0], matrix: inv.clone().multiply(mesh.matrixWorld) });
  });
  // Las instancias no usan formas animables (morph targets): sin esto el render se rompe.
  for (const part of parts) {
    if (Object.keys(part.geometry.morphAttributes).length === 0) continue;
    part.geometry = part.geometry.clone();
    part.geometry.morphAttributes = {};
  }
  return parts;
}

interface Chunk {
  center: THREE.Vector2;
  near: THREE.Group;
  far: THREE.Group | null;
  spec: KindSpec;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function itemMatrix(p: StreetProp, kindScale: number): THREE.Matrix4 {
  const s = kindScale * (p.scale ?? 1);
  _q.setFromAxisAngle(_up, p.rotationY);
  return new THREE.Matrix4().compose(_p.set(p.position[0], p.position[1], p.position[2]), _q, _s.set(s, s, s));
}

function chunkKey(p: StreetProp): string {
  return `${Math.floor(p.position[0] / CHUNK)}:${Math.floor(p.position[2] / CHUNK)}`;
}

/** Arma los grupos de dibujo de un tipo de cosa: instancias del modelo y, si corresponde, del impostor. */
function buildChunks(items: StreetProp[], parts: Part[], spec: KindSpec, impostor: Impostor | null): Chunk[] {
  const byChunk = new Map<string, StreetProp[]>();
  for (const p of items) byChunk.set(chunkKey(p), [...(byChunk.get(chunkKey(p)) ?? []), p]);
  const out: Chunk[] = [];
  for (const list of byChunk.values()) {
    const matrices = list.map((p) => itemMatrix(p, spec.scale ?? 1));
    const near = new THREE.Group();
    for (const part of parts) {
      const inst = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      matrices.forEach((m, i) => inst.setMatrixAt(i, _m.multiplyMatrices(m, part.matrix)));
      inst.castShadow = spec.shadow ?? false;
      inst.receiveShadow = true;
      inst.computeBoundingSphere();
      near.add(inst);
    }
    let far: THREE.Group | null = null;
    if (impostor) {
      far = new THREE.Group();
      const inst = new THREE.InstancedMesh(impostor.geometry, impostor.material, list.length);
      matrices.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.customDepthMaterial = impostor.depthMaterial;
      inst.castShadow = spec.shadow ?? false;
      inst.computeBoundingSphere();
      far.add(inst);
    }
    const cx = list.reduce((a, p) => a + p.position[0], 0) / list.length;
    const cz = list.reduce((a, p) => a + p.position[2], 0) / list.length;
    out.push({ center: new THREE.Vector2(cx, cz), near, far, spec });
  }
  return out;
}

/** Sólo arroja sombra (no se ve): la silueta de los impostores para todos los árboles y faroles. */
const SHADOW_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Árboles y faroles: miles de copias como impostor y unas pocas, las más
 * cercanas, con el modelo completo. Las sombras salen siempre de la silueta.
 */
class NearPool {
  readonly group = new THREE.Group();
  private readonly matrices: THREE.Matrix4[];
  private readonly near: { mesh: THREE.InstancedMesh; part: Part }[];
  private readonly impostors: THREE.InstancedMesh;
  private current: number[] = [];

  constructor(
    private readonly items: StreetProp[],
    parts: Part[],
    private readonly spec: KindSpec,
    impostor: Impostor,
  ) {
    this.matrices = items.map((p) => itemMatrix(p, spec.scale ?? 1));
    const k = spec.pool ?? 4;
    this.near = parts.map((part) => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, k);
      mesh.count = 0;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return { mesh, part };
    });
    this.impostors = new THREE.InstancedMesh(impostor.geometry, impostor.material, items.length);
    this.matrices.forEach((m, i) => this.impostors.setMatrixAt(i, m));
    this.impostors.frustumCulled = false;
    this.impostors.receiveShadow = true;
    this.group.add(this.impostors);
    if (spec.shadow) {
      const shadows = new THREE.InstancedMesh(impostor.geometry, SHADOW_ONLY, items.length);
      this.matrices.forEach((m, i) => shadows.setMatrixAt(i, m));
      shadows.customDepthMaterial = impostor.depthMaterial;
      shadows.castShadow = true;
      // No se ve: que el autofoco no lo tome como algo donde enfocar.
      shadows.raycast = () => {};
      shadows.frustumCulled = false;
      this.group.add(shadows);
    }
  }

  /** Elige los más cercanos a la cámara y les pone el modelo completo. */
  update(cx: number, cz: number) {
    const near2 = this.spec.near * this.spec.near;
    const picked = this.items
      .map((p, i) => ({ i, d: (p.position[0] - cx) ** 2 + (p.position[2] - cz) ** 2 }))
      .filter((x) => x.d < near2)
      .sort((a, b) => a.d - b.d)
      .slice(0, this.spec.pool ?? 4)
      .map((x) => x.i);
    for (const i of this.current) if (!picked.includes(i)) this.impostors.setMatrixAt(i, this.matrices[i]);
    for (const i of picked) this.impostors.setMatrixAt(i, HIDDEN);
    this.impostors.instanceMatrix.needsUpdate = true;
    for (const { mesh, part } of this.near) {
      picked.forEach((i, j) => mesh.setMatrixAt(j, _m.multiplyMatrices(this.matrices[i], part.matrix)));
      mesh.count = picked.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.current = picked;
  }
}

const URLS = Object.values(MODEL_BY_KIND);
const KINDS = Object.keys(MODEL_BY_KIND) as ModelKind[];

/** Luminarias: brillan de noche y las más cercanas iluminan con luz real. */
function LampLights({ heads }: { heads: THREE.Vector3[] }) {
  const camera = useThree((s) => s.camera);
  const lights = useRef<(THREE.SpotLight | null)[]>([]);
  const targets = useMemo(() => Array.from({ length: ACTIVE_LAMP_LIGHTS }, () => new THREE.Object3D()), []);
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2620", emissive: "#ffd7a0", emissiveIntensity: 0 }), []);
  const bulbs = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.16, 12, 8);
    const inst = new THREE.InstancedMesh(geo, glow, heads.length);
    heads.forEach((h, i) => inst.setMatrixAt(i, _m.makeTranslation(h.x, h.y, h.z)));
    inst.computeBoundingSphere();
    return inst;
  }, [heads, glow]);

  useFrame(() => {
    const night = THREE.MathUtils.clamp((2 - simulatorRuntime.sunState.elevationDeg) / 8, 0, 1);
    glow.emissiveIntensity = night * 40;
    bulbs.visible = night > 0.01;
    const nearest = heads
      .map((h, i) => ({ i, d: (h.x - camera.position.x) ** 2 + (h.z - camera.position.z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.min(ACTIVE_LAMP_LIGHTS, simulatorRuntime.quality.lampLights));
    lights.current.forEach((light, slot) => {
      if (!light) return;
      const pick = nearest[slot];
      if (!pick || night < 0.01) {
        light.visible = false;
        return;
      }
      const h = heads[pick.i];
      light.visible = true;
      light.position.set(h.x, h.y - 0.2, h.z);
      // La luminaria apunta al piso: deja una pileta de luz en la vereda y la calle.
      targets[slot].position.set(h.x, 0, h.z);
      targets[slot].updateMatrixWorld();
      light.intensity = night * 520;
    });
  });

  return (
    <>
      <primitive object={bulbs} />
      {targets.map((t, i) => (
        <group key={i}>
          <primitive object={t} />
          <spotLight
            ref={(el) => {
              lights.current[i] = el;
            }}
            target={t}
            color="#ffcf94"
            angle={1.05}
            penumbra={0.8}
            distance={26}
            decay={2}
          />
        </group>
      ))}
    </>
  );
}

/**
 * Mobiliario, árboles y autos estacionados de toda la ciudad. Cada tipo se
 * dibuja instanciado por grupos de 40 m: los grupos lejanos se apagan y los
 * árboles y faroles de media distancia pasan a su impostor.
 */
export default function StreetProps({ layout }: { layout: StreetLayout }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const gltfs = useGLTF(URLS);
  const cars = useStreetCars();

  const chunks = useMemo(() => {
    const out: Chunk[] = [];
    const pools: NearPool[] = [];
    const impostors: Impostor[] = [];
    const byKind = new Map<PropKind, StreetProp[]>();
    for (const p of layout.props) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p]);
    KINDS.forEach((kind, i) => {
      const items = byKind.get(kind);
      if (!items?.length) return;
      const spec = SPEC[kind] ?? SMALL;
      const scene = gltfs[i].scene;
      const impostor = spec.impostor ? makeImpostor(gl, scene) : null;
      if (impostor) impostors.push(impostor);
      let parts = flattenParts(scene);
      // El monumento es de bronce, como los de las plazas argentinas.
      if (kind === "statue") parts = parts.map((p) => ({ ...p, material: BRONZE }));
      if (impostor && spec.pool) pools.push(new NearPool(items, parts, spec, impostor));
      else out.push(...buildChunks(items, parts, spec, impostor));
    });
    // Estacionados: un modelo distinto cada vez, siguiendo la lista donde la deja el tránsito.
    const parked = byKind.get("car") ?? [];
    const byModel = new Map<number, StreetProp[]>();
    parked.forEach((p, i) => {
      const model = STREET_CARS.indexOf(streetCarFor(11 + i));
      byModel.set(model, [...(byModel.get(model) ?? []), p]);
    });
    for (const [model, items] of byModel) out.push(...buildChunks(items, flattenParts(cars[model].object), SPEC.car!, null));
    return { list: out, pools, dispose: () => impostors.forEach((x) => x.dispose()) };
  }, [layout, gltfs, cars, gl]);

  // Las fotos de los impostores viven en la placa de video: si se liberan no se pueden
  // volver a usar. React (en desarrollo) desmonta y vuelve a montar enseguida: se libera
  // recién si no volvió a montarse.
  const pendingDispose = useRef<typeof chunks | null>(null);
  useEffect(() => {
    if (pendingDispose.current === chunks) pendingDispose.current = null;
    return () => {
      pendingDispose.current = chunks;
      setTimeout(() => {
        if (pendingDispose.current === chunks) chunks.dispose();
      }, 0);
    };
  }, [chunks]);

  const heads = useMemo(
    () =>
      layout.props
        .filter((p) => p.kind === "lamp" || p.kind === "plaza-lamp")
        .map((p) =>
          p.kind === "lamp"
            ? new THREE.Vector3(p.position[0] + Math.cos(p.rotationY) * LAMP_ARM, LAMP_HEAD_HEIGHT, p.position[2] - Math.sin(p.rotationY) * LAMP_ARM)
            : new THREE.Vector3(p.position[0], PLAZA_LAMP_HEAD, p.position[2]),
        ),
    [layout],
  );

  // Cada ~0,2 s: qué grupos se dibujan completos, cuáles como impostor y cuáles no.
  const tick = useRef(0);
  useFrame((_, delta) => {
    tick.current -= delta;
    if (tick.current > 0) return;
    tick.current = 0.2;
    const cx = camera.position.x;
    const cz = camera.position.z;
    for (const c of chunks.list) {
      const d = Math.hypot(c.center.x - cx, c.center.y - cz) - CHUNK * 0.7;
      c.near.visible = d < c.spec.near;
      if (c.far) c.far.visible = !c.near.visible && d < c.spec.draw;
    }
    for (const p of chunks.pools) p.update(cx, cz);
  });

  return (
    <group name="calle-objetos">
      {chunks.list.map((c, i) => (
        <group key={i}>
          <primitive object={c.near} />
          {c.far ? <primitive object={c.far} /> : null}
        </group>
      ))}
      {chunks.pools.map((p, i) => (
        <primitive key={`pool-${i}`} object={p.group} />
      ))}
      <LampLights heads={heads} />
    </group>
  );
}

for (const url of URLS) useGLTF.preload(url);
