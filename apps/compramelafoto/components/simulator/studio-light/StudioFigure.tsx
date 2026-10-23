"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ANIMATIONS, animationUrl, decodeClip, type CompactClip } from "@/lib/simulator/studio-light/animation-clip";
import { bakeCavityAO } from "@/lib/simulator/studio-light/cavity-ao";
import { figureUrl, type FigureSpec } from "@/lib/simulator/studio-light/figures";
import { SUBJECT_HEAD } from "@/lib/simulator/studio-light/metering";
import {
  SEQUENCES,
  STOOL_SEAT_Y,
  armDirections,
  legDirections,
  lerpPose,
  sampleSequence,
  type PoseBase,
  type PoseParams,
} from "@/lib/simulator/studio-light/poses";

/**
 * Las texturas del FBX apuntan a .tga con rutas de Windows; las ignoramos
 * (textura vacía) y armamos los materiales con nuestros JPG/PNG livianos.
 */
class EmptyTextureLoader extends THREE.Loader<THREE.Texture> {
  load(): THREE.Texture {
    return new THREE.Texture();
  }
}

const DEG = Math.PI / 180;

type Bones = Record<string, THREE.Bone | undefined>;

interface Rig {
  root: THREE.Group;
  /** El FBX clonado: raíz del esqueleto para el mezclador de animaciones. */
  model: THREE.Group;
  /** Grupo cuyo marco es el del personaje: +Z adelante, +Y arriba. */
  character: THREE.Object3D;
  bones: Bones;
  rest: Map<THREE.Bone, THREE.Quaternion>;
  restPos: Map<THREE.Bone, THREE.Vector3>;
  /** Altura de los pies sobre el piso en la pose de reposo (referencia de apoyo). */
  restFootY: number;
  /** Tutú de la bailarina (sigue a la cadera), si el modelo lo usa. */
  tutu: THREE.Object3D | null;
  materials: THREE.Material[];
  textures: THREE.Texture[];
}

const BONE_NAMES = [
  "Pelvis",
  "Spine",
  "Spine1",
  "Spine2",
  "Neck",
  "Head",
  "L_UpperArm",
  "L_Forearm",
  "L_Hand",
  "R_UpperArm",
  "R_Forearm",
  "R_Hand",
  "L_Thigh",
  "L_Calf",
  "R_Thigh",
  "R_Calf",
  "L_Foot",
  "R_Foot",
  "L_Toe0",
  "R_Toe0",
  "LEye",
  "REye",
];

function bonePos(root: THREE.Object3D, bone: THREE.Object3D): THREE.Vector3 {
  return root.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
}

/** Altura de un hueso medida en el marco de la raíz del modelo. */
function boneY(root: THREE.Object3D, bone: THREE.Bone | undefined): number {
  return bone ? bonePos(root, bone).y : Infinity;
}


/** Tutú de tul: tres capas cónicas, apenas transparentes. */
function buildTutu(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: "#f7f2f4",
    roughness: 0.9,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  [
    [0.15, 0.42, -0.04],
    [0.15, 0.38, -0.015],
    [0.15, 0.33, 0.01],
  ].forEach(([top, bottom, y]) => {
    const layer = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, 0.07, 48, 1, true), mat);
    layer.position.y = y;
    layer.castShadow = true;
    group.add(layer);
  });
  return group;
}

function basisQuat(x: number[], y: number[], z: number[]): THREE.Quaternion {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z));
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/** Orientación del cuerpo acostado: la cabeza hacia +X y el cuerpo hacia −X. */
const LYING: Partial<Record<PoseBase, THREE.Quaternion>> = {
  "lie-back": basisQuat([0, 0, 1], [1, 0, 0], [0, 1, 0]),
  "lie-side": basisQuat([0, -1, 0], [1, 0, 0], [0, 0, 1]),
  "lie-front": basisQuat([0, 0, -1], [1, 0, 0], [0, -1, 0]),
};


function buildRig(source: THREE.Group, figure: FigureSpec): Rig {
  const model = cloneSkinned(source) as THREE.Group;
  const textureLoader = new THREE.TextureLoader();
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  const cache = new Map<string, THREE.Material>();

  const tex = (file: string, color: boolean) => {
    const t = textureLoader.load(figureUrl(figure, file));
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    textures.push(t);
    return t;
  };

  const materialFor = (name: string): THREE.Material => {
    const hit = cache.get(name);
    if (hit) return hit;
    const prefix = name.split("_")[0];
    let m: THREE.Material;
    if (name.endsWith("_opacity")) {
      // Pelo, pestañas y cejas: recorte por alfa (proyecta sombra y no necesita ordenar).
      m = new THREE.MeshStandardMaterial({
        map: tex(`${prefix}_opacity_color.png`, true),
        alphaTest: 0.35,
        alphaToCoverage: true,
        side: THREE.DoubleSide,
        roughness: 0.75,
      });
    } else {
      const part = name.endsWith("_head") ? "head" : "body";
      m = new THREE.MeshStandardMaterial({
        map: tex(`${prefix}_${part}_color.jpg`, true),
        normalMap: tex(`${prefix}_${part}_normal.jpg`, false),
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughness: part === "head" ? 0.55 : 0.78,
        // Oclusión de cavidades horneada en los vértices (ver bakeCavityAO).
        vertexColors: true,
      });
    }
    m.name = name;
    cache.set(name, m);
    materials.push(m);
    return m;
  };

  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    // El FBX trae cinco niveles de detalle: mostramos sólo el de máxima calidad.
    if (!mesh.name.includes("hipoly")) {
      mesh.visible = false;
      return;
    }
    // Radio de ~2,5 cm para nariz, orejas y boca. Las unidades internas del FBX varían,
    // así que se deduce de la altura de la malla (una persona mide ~1,72 m).
    // Se hornea en toda malla visible: en algunos modelos piel, ropa y pelo son una sola
    // malla, y un material con vertexColors sin atributo de color se ve negro.
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    const height = box ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) : 0;
    bakeCavityAO(mesh.geometry, { radius: height > 0 ? (height * 0.025) / 1.72 : 1 });
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const rebuilt = mats.map((m) => materialFor(m.name));
    mesh.material = Array.isArray(mesh.material) ? rebuilt : rebuilt[0];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  });

  const bones: Bones = {};
  for (const n of BONE_NAMES) {
    bones[n] = model.getObjectByName(`Bip01_${n}`) as THREE.Bone | undefined;
  }
  const rest = new Map<THREE.Bone, THREE.Quaternion>();
  const restPos = new Map<THREE.Bone, THREE.Vector3>();
  model.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return;
    rest.set(o as THREE.Bone, o.quaternion.clone());
    restPos.set(o as THREE.Bone, o.position.clone());
  });

  // Escala: el FBX viene en centímetros. Llevamos los ojos a la altura que usa el fotómetro.
  const character = new THREE.Group();
  character.add(model);
  model.scale.setScalar(0.01);
  character.updateMatrixWorld(true);
  const eye = new THREE.Vector3();
  (bones.LEye ?? bones.Head)?.getWorldPosition(eye);
  const box = new THREE.Box3().setFromObject(model, true);
  const scale = eye.y > 0.5 ? THREE.MathUtils.clamp(SUBJECT_HEAD[1] / (eye.y - box.min.y), 0.85, 1.15) : 1;
  model.scale.setScalar(0.01 * scale);
  character.updateMatrixWorld(true);
  const feet = new THREE.Box3().setFromObject(model, true).min.y;
  model.position.y -= feet;

  const root = new THREE.Group();
  root.add(character);
  root.updateMatrixWorld(true);
  const restFootY = Math.min(...["L_Toe0", "R_Toe0", "L_Foot", "R_Foot"].map((n) => boneY(root, bones[n])));

  let tutu: THREE.Object3D | null = null;
  if (figure.tutu) {
    tutu = buildTutu();
    tutu.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) materials.push(m.material as THREE.Material);
    });
    root.add(tutu);
  }
  return { root, model, character, bones, rest, restPos, restFootY, tutu, materials, textures };
}

/**
 * Ubica el cuerpo según su apoyo, después de posar los huesos: pies en el piso,
 * pelvis sobre el banquito, rodillas en el piso o acostado con la cabeza en el
 * centro del set. `lift` eleva (saltos) y `spin` gira sobre sí mismo (piruetas).
 */
function placeBody(rig: Rig, base: PoseBase, lift = 0, spin = 0) {
  const c = rig.character;
  const B = rig.bones;
  const lying = LYING[base];
  c.quaternion.copy(lying ?? new THREE.Quaternion());
  if (spin) c.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin * DEG));
  c.position.set(0, 0, 0);
  rig.root.updateMatrixWorld(true);

  const feet = ["L_Toe0", "R_Toe0", "L_Foot", "R_Foot"].map((n) => boneY(rig.root, B[n]));
  if (base === "stand") {
    c.position.y = rig.restFootY - Math.min(...feet) + lift;
  } else if (base === "stool" || base === "floor") {
    const pelvis = B.Pelvis ? bonePos(rig.root, B.Pelvis) : new THREE.Vector3();
    c.position.set(-pelvis.x, (base === "stool" ? STOOL_SEAT_Y + 0.1 : 0.11) - pelvis.y, -pelvis.z - 0.02);
  } else if (base === "kneel") {
    const pelvis = B.Pelvis ? bonePos(rig.root, B.Pelvis) : new THREE.Vector3();
    const low = Math.min(...feet, boneY(rig.root, B.L_Calf), boneY(rig.root, B.R_Calf));
    c.position.set(-pelvis.x, 0.06 - low, -pelvis.z);
  } else {
    // Acostado: el punto más bajo del cuerpo apoyado en la colchoneta y la cabeza al centro.
    let low = Infinity;
    for (const bone of rig.rest.keys()) low = Math.min(low, boneY(rig.root, bone));
    const head = B.Head ? bonePos(rig.root, B.Head) : new THREE.Vector3();
    c.position.set(-head.x, 0.12 - low, -head.z);
  }
  rig.root.updateMatrixWorld(true);

  if (rig.tutu && B.Pelvis) {
    rig.tutu.position.copy(bonePos(rig.root, B.Pelvis)).add(new THREE.Vector3(0, 0.03, 0).applyQuaternion(c.quaternion));
    rig.tutu.quaternion.copy(c.quaternion);
  }
}

const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const charInv = new THREE.Matrix4();
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const euler = new THREE.Euler();

/** Aplica una rotación expresada en el espacio del personaje a un hueso. */
function rotateInCharacter(rig: Rig, bone: THREE.Bone | undefined, q: THREE.Quaternion) {
  if (!bone?.parent) return;
  const charQ = rig.character.getWorldQuaternion(tmpQ2).invert();
  const parentInChar = bone.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(charQ);
  const inv = parentInChar.clone().invert();
  bone.quaternion.premultiply(parentInChar).premultiply(q).premultiply(inv);
  bone.updateMatrixWorld(true);
}

function rotateEuler(rig: Rig, bone: THREE.Bone | undefined, x: number, y: number, z: number) {
  if (!bone || (x === 0 && y === 0 && z === 0)) return;
  rotateInCharacter(rig, bone, tmpQ.setFromEuler(euler.set(x * DEG, y * DEG, z * DEG, "YXZ")));
}

/** Gira `bone` para que apunte (hacia su hijo `child`) en la dirección dada. */
function aim(rig: Rig, bone: THREE.Bone | undefined, child: THREE.Bone | undefined, dir: [number, number, number]) {
  if (!bone || !child) return;
  charInv.copy(rig.character.matrixWorld).invert();
  bone.getWorldPosition(a).applyMatrix4(charInv);
  child.getWorldPosition(b).applyMatrix4(charInv);
  const current = b.sub(a).normalize();
  const target = new THREE.Vector3(...dir).normalize();
  rotateInCharacter(rig, bone, tmpQ.setFromUnitVectors(current, target));
}

function applyPose(rig: Rig, p: PoseParams, lift = 0, spin = 0) {
  for (const [bone, q] of rig.rest) bone.quaternion.copy(q);
  // Una animación pudo mover la raíz y la pelvis: vuelven a su lugar.
  for (const [bone, v] of rig.restPos) bone.position.copy(v);
  // Los huesos se posan con el cuerpo derecho; placeBody lo ubica al final.
  rig.character.position.set(0, 0, 0);
  rig.character.quaternion.identity();
  rig.character.updateWorldMatrix(true, true);
  const B = rig.bones;

  // Peso en una pierna: cadera inclinada; si las piernas no se definen a mano,
  // la rodilla libre se dobla sola y el torso compensa.
  const w = p.weight;
  rotateEuler(rig, B.Pelvis, 0, 0, 4 * w);
  if (!p.legs) {
    const free = w > 0 ? "R" : "L";
    const bend = 9 * Math.abs(w);
    rotateEuler(rig, B[`${free}_Thigh`], -bend, 0, 0);
    rotateEuler(rig, B[`${free}_Calf`], 2 * bend, 0, 0);
  }

  const spine = [B.Spine, B.Spine1, B.Spine2].filter(Boolean) as THREE.Bone[];
  for (const bone of spine) {
    rotateEuler(rig, bone, p.torsoLean / spine.length, p.torsoTurn / spine.length, (p.torsoBend - 4 * w) / spine.length);
  }
  rotateEuler(rig, B.Neck, p.headNod * 0.4, p.headTurn * 0.4, -p.headTilt * 0.4);
  rotateEuler(rig, B.Head, p.headNod * 0.6, p.headTurn * 0.6, -p.headTilt * 0.6);

  for (const side of [1, -1] as const) {
    const s = side === 1 ? "L" : "R";
    const dirs = armDirections(side === 1 ? p.left : p.right, side);
    aim(rig, B[`${s}_UpperArm`], B[`${s}_Forearm`], dirs.upper);
    aim(rig, B[`${s}_Forearm`], B[`${s}_Hand`], dirs.fore);
  }

  if (p.legs) {
    for (const side of [1, -1] as const) {
      const s = side === 1 ? "L" : "R";
      const dirs = legDirections(side === 1 ? p.legs.left : p.legs.right, side);
      aim(rig, B[`${s}_Thigh`], B[`${s}_Calf`], dirs.thigh);
      aim(rig, B[`${s}_Calf`], B[`${s}_Foot`], dirs.calf);
    }
  }
  // Pies en punta: el empeine se estira hacia abajo (relevé).
  if (p.pointe > 0) {
    rotateEuler(rig, B.L_Foot, 58 * p.pointe, 0, 0);
    rotateEuler(rig, B.R_Foot, 58 * p.pointe, 0, 0);
  }
  placeBody(rig, p.base, lift, spin);
}

/**
 * Movimiento natural encima de la pose: respiración en el pecho, balanceo de
 * cadera y micro-movimientos de cabeza, con frecuencias que no se repiten juntas.
 */
function applyNatural(rig: Rig, t: number) {
  const B = rig.bones;
  const breath = Math.sin(t * Math.PI * 2 * 0.24);
  const sway = Math.sin(t * Math.PI * 2 * 0.085 + 0.6);
  for (const bone of [B.Spine1, B.Spine2]) rotateEuler(rig, bone, -0.7 * breath, 0, 0);
  rotateEuler(rig, B.Pelvis, 0, 0.5 * sway, 0.6 * sway);
  rotateEuler(rig, B.Head, 0.9 * Math.sin(t * 0.83 + 1.1) + 0.5 * breath, 1.6 * Math.sin(t * 0.31 + 2), 0.6 * Math.sin(t * 0.47));
}

const clipCache = new Map<string, Promise<THREE.AnimationClip>>();

function loadClip(url: string): Promise<THREE.AnimationClip> {
  let hit = clipCache.get(url);
  if (!hit) {
    hit = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo cargar ${url}`);
        return r.json();
      })
      .then((data: CompactClip) => decodeClip(data));
    clipCache.set(url, hit);
  }
  return hit;
}

/** Banquito de estudio: asiento redondo y cuatro patas. */
function Stool() {
  const legs = [0, 1, 2, 3].map((i) => (i / 4) * Math.PI * 2 + Math.PI / 4);
  return (
    <group position={[0, 0, -0.02]}>
      <mesh position={[0, STOOL_SEAT_Y - 0.025, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.05, 32]} />
        <meshStandardMaterial color="#1c1d21" roughness={0.6} />
      </mesh>
      {legs.map((a) => (
        <mesh
          key={a}
          position={[Math.sin(a) * 0.14, (STOOL_SEAT_Y - 0.05) / 2, Math.cos(a) * 0.14]}
          rotation={[Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12]}
          castShadow
        >
          <cylinderGeometry args={[0.014, 0.016, STOOL_SEAT_Y - 0.05, 8]} />
          <meshStandardMaterial color="#8d939c" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.135, 0.008, 8, 32]} />
        <meshStandardMaterial color="#8d939c" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Colchoneta para las poses en el piso y acostadas. */
function Mat({ lying }: { lying: boolean }) {
  return (
    <mesh position={[lying ? -0.72 : 0, 0.015, lying ? 0 : 0.05]} receiveShadow>
      <boxGeometry args={[lying ? 2 : 1.3, 0.03, lying ? 0.85 : 1.1]} />
      <meshStandardMaterial color="#3b3f47" roughness={0.95} />
    </mesh>
  );
}

export interface FigureMotion {
  /** Respira y se balancea mientras mantiene la pose. */
  natural: boolean;
  /** Animación completa en curso (id de ANIMATIONS) o null para la pose fija. */
  clip: string | null;
}

export default function StudioFigure({
  figure,
  yaw,
  pose,
  motion,
}: {
  figure: FigureSpec;
  yaw: number;
  pose: PoseParams;
  motion: FigureMotion;
}) {
  const source = useLoader(FBXLoader, figureUrl(figure, "model.fbx"), (loader) => {
    const manager = new THREE.LoadingManager();
    manager.addHandler(/\.tga$/i, new EmptyTextureLoader());
    loader.manager = manager;
  });
  const rig = useMemo(() => buildRig(source, figure), [source, figure]);
  const mixer = useMemo(() => new THREE.AnimationMixer(rig.model), [rig]);
  // Se guarda junto con su URL: si cambia la animación pedida, la vieja deja de valer sola.
  const [loaded, setLoaded] = useState<{ url: string; clip: THREE.AnimationClip } | null>(null);
  const wanted = ANIMATIONS.find((x) => x.id === motion.clip);
  const wantedUrl = wanted ? animationUrl(wanted, figure.gender) : null;
  const clip = loaded && loaded.url === wantedUrl ? loaded.clip : null;
  const current = useRef<PoseParams>(pose);
  const from = useRef<PoseParams>(pose);
  const t = useRef(1);

  useEffect(
    () => () => {
      rig.materials.forEach((m) => m.dispose());
      rig.textures.forEach((x) => x.dispose());
    },
    [rig],
  );

  // Arranca una transición cada vez que cambia la pose pedida.
  useEffect(() => {
    from.current = current.current;
    t.current = 0;
  }, [pose]);

  useEffect(() => {
    applyPose(rig, current.current);
  }, [rig]);

  // Carga la animación elegida (versión de mujer u hombre según el modelo).
  useEffect(() => {
    if (!wantedUrl) return;
    let alive = true;
    loadClip(wantedUrl)
      .then((c) => {
        if (alive) setLoaded({ url: wantedUrl, clip: c });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [wantedUrl]);

  useEffect(() => {
    if (!clip) {
      mixer.stopAllAction();
      applyPose(rig, current.current);
      return;
    }
    rig.character.position.set(0, 0, 0);
    rig.character.quaternion.identity();
    const action = mixer.clipAction(clip);
    action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.35).play();
    return () => {
      action.stop();
    };
  }, [clip, mixer, rig]);

  useEffect(
    () => () => {
      mixer.stopAllAction();
    },
    [mixer],
  );

  const sequence = SEQUENCES.find((q) => q.id === motion.clip) ?? null;
  const seqStart = useRef(0);
  useEffect(() => {
    seqStart.current = -1;
  }, [sequence]);

  useFrame((state, delta) => {
    if (sequence) {
      if (seqStart.current < 0) seqStart.current = state.clock.elapsedTime;
      const sample = sampleSequence(sequence, state.clock.elapsedTime - seqStart.current);
      current.current = sample.pose;
      applyPose(rig, sample.pose, sample.lift, sample.spin);
      return;
    }
    if (clip) {
      mixer.update(delta);
      // El tutú sigue a la cadera también en las animaciones capturadas.
      if (rig.tutu && rig.bones.Pelvis) {
        rig.root.updateMatrixWorld(true);
        rig.tutu.position.copy(bonePos(rig.root, rig.bones.Pelvis)).add(new THREE.Vector3(0, 0.03, 0));
        rig.tutu.quaternion.identity();
      }
      return;
    }
    const moving = t.current < 1;
    if (moving) {
      t.current = Math.min(1, t.current + delta * 3.5);
      const k = t.current * t.current * (3 - 2 * t.current);
      current.current = lerpPose(from.current, pose, k);
    }
    if (!moving && !motion.natural) return;
    applyPose(rig, current.current);
    if (motion.natural) applyNatural(rig, state.clock.elapsedTime);
  });

  const base = current.current.base === pose.base ? pose.base : pose.base;
  return (
    <group rotation={[0, yaw * DEG, 0]}>
      <primitive object={rig.root} />
      {base === "stool" && !motion.clip ? <Stool /> : null}
      {(base === "floor" || base === "kneel" || base.startsWith("lie")) && !motion.clip ? <Mat lying={base.startsWith("lie")} /> : null}
    </group>
  );
}
