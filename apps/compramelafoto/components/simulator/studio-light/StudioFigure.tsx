"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { bakeCavityAO } from "@/lib/simulator/studio-light/cavity-ao";
import { figureUrl, type FigureSpec } from "@/lib/simulator/studio-light/figures";
import { SUBJECT_HEAD } from "@/lib/simulator/studio-light/metering";
import { armDirections, lerpPose, type PoseParams } from "@/lib/simulator/studio-light/poses";

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
  /** Grupo cuyo marco es el del personaje: +Z adelante, +Y arriba. */
  character: THREE.Object3D;
  bones: Bones;
  rest: Map<THREE.Bone, THREE.Quaternion>;
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
  "LEye",
  "REye",
];

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
  model.traverse((o) => {
    if ((o as THREE.Bone).isBone) rest.set(o as THREE.Bone, o.quaternion.clone());
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
  return { root, character, bones, rest, materials, textures };
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

function applyPose(rig: Rig, p: PoseParams) {
  for (const [bone, q] of rig.rest) bone.quaternion.copy(q);
  rig.character.updateWorldMatrix(true, true);
  const B = rig.bones;

  // Peso en una pierna: cadera inclinada, rodilla libre doblada y torso que compensa.
  const w = p.weight;
  rotateEuler(rig, B.Pelvis, 0, 0, 4 * w);
  const free = w > 0 ? "R" : "L";
  const bend = 9 * Math.abs(w);
  rotateEuler(rig, B[`${free}_Thigh`], -bend, 0, 0);
  rotateEuler(rig, B[`${free}_Calf`], 2 * bend, 0, 0);

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
}

export default function StudioFigure({ figure, yaw, pose }: { figure: FigureSpec; yaw: number; pose: PoseParams }) {
  const source = useLoader(FBXLoader, figureUrl(figure, "model.fbx"), (loader) => {
    const manager = new THREE.LoadingManager();
    manager.addHandler(/\.tga$/i, new EmptyTextureLoader());
    loader.manager = manager;
  });
  const rig = useMemo(() => buildRig(source, figure), [source, figure]);
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

  useFrame((_, delta) => {
    if (t.current >= 1) return;
    t.current = Math.min(1, t.current + delta * 3.5);
    const k = t.current * t.current * (3 - 2 * t.current);
    current.current = lerpPose(from.current, pose, k);
    applyPose(rig, current.current);
  });

  return (
    <group rotation={[0, yaw * DEG, 0]}>
      <primitive object={rig.root} />
    </group>
  );
}
