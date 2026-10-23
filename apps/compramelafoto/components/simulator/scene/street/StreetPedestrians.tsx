"use client";

import { simulatorRuntime, syncMovingSubjectsRegistry } from "@/lib/simulator/simulator-runtime";
import type { MovingSubjectState } from "@/lib/simulator/moving-subject-types";
import { STREET_PERSON_ID_PREFIX } from "@/lib/simulator/moving-subject-types";
import { ANIMATION_DIR, decodeClip, type CompactClip } from "@/lib/simulator/studio-light/animation-clip";
import { figureById, figureUrl, type FigureSpec } from "@/lib/simulator/studio-light/figures";
import { streetGroundHeight, type StreetLayout } from "@/lib/simulator/street/street-layout";
import { streetRuntime } from "@/lib/simulator/street/street-runtime";
import {
  isWoman,
  planStreetPeople,
  samplePath,
  type StreetStander,
  type StreetWalker,
} from "@/lib/simulator/street/street-people";
import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/** Devuelve una textura vacía en lugar de pedir el archivo. */
class EmptyTextureLoader extends THREE.Loader<THREE.Texture> {
  load(): THREE.Texture {
    return new THREE.Texture();
  }
}

/** Altura del pecho para el autofoco (m). */
const CHEST_Y = 1.3;

function clipUrl(figure: string, name: string): string {
  return `${ANIMATION_DIR}/${isWoman(figure) ? "f" : "m"}_${name}.json`;
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

interface Person {
  id: string;
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  walker?: StreetWalker;
  /** Metros por segundo que corresponden a la zancada del clip. */
  speed: number;
  distance: number;
  heading: number;
}

/**
 * Velocidad de marcha que no hace patinar los pies: cuánto se desplaza el pie
 * de apoyo hacia atrás respecto del cuerpo durante el ciclo.
 */
function strideSpeed(model: THREE.Object3D, clip: THREE.AnimationClip): number {
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip);
  action.play();
  const foot = model.getObjectByName("Bip01_L_Foot");
  const pelvis = model.getObjectByName("Bip01_Pelvis");
  if (!foot || !pelvis) return 1.35;
  const samples = 30;
  let min = Infinity;
  let max = -Infinity;
  const fp = new THREE.Vector3();
  const pp = new THREE.Vector3();
  for (let i = 0; i <= samples; i += 1) {
    mixer.setTime((clip.duration * i) / samples);
    model.updateMatrixWorld(true);
    foot.getWorldPosition(fp);
    pelvis.getWorldPosition(pp);
    // El avatar mira a +Z: el pie va y viene a lo largo de Z.
    const along = fp.z - pp.z;
    min = Math.min(min, along);
    max = Math.max(max, along);
  }
  mixer.stopAllAction();
  // El pie apoya ~60 % del ciclo y en ese tramo recorre toda su excursión.
  const speed = (max - min) / (0.6 * clip.duration);
  return THREE.MathUtils.clamp(speed, 0.6, 2.2);
}

function makePerson(
  id: string,
  source: THREE.Group,
  figure: FigureSpec,
  clip: THREE.AnimationClip,
  cache: Map<string, THREE.Material>,
): { root: THREE.Group; mixer: THREE.AnimationMixer; model: THREE.Object3D } {
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
    o.userData.codSubjectId = `${STREET_PERSON_ID_PREFIX}${id}`;
  });
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip);
  action.time = Math.random() * clip.duration;
  action.play();
  return { root, mixer, model };
}

function useCompactClips(urls: string[]): THREE.AnimationClip[] {
  const texts = useLoader(THREE.FileLoader, urls) as unknown as string[];
  return useMemo(() => texts.map((t) => decodeClip(JSON.parse(t) as CompactClip)), [texts]);
}

export default function StreetPedestrians({ layout }: { layout: StreetLayout }) {
  const { walkers, standers } = useMemo(() => planStreetPeople(layout), [layout]);
  const figureIds = useMemo(
    () => [...new Set([...walkers, ...standers].map((p) => p.figure))],
    [walkers, standers],
  );
  const specs = useMemo(() => figureIds.map((id) => figureById(id)!), [figureIds]);
  const sources = useLoader(
    FBXLoader,
    specs.map((f) => figureUrl(f, "model.fbx")),
    (loader) => {
      // El FBX menciona texturas .tga que no se publican: se reemplazan en dressAvatar.
      const manager = new THREE.LoadingManager();
      manager.addHandler(/\.tga$/i, new EmptyTextureLoader());
      loader.manager = manager;
    },
  ) as THREE.Group[];

  const clipNames = useMemo(() => {
    const list: string[] = [];
    for (const w of walkers) list.push(clipUrl(w.figure, w.gait));
    for (const s of standers) list.push(clipUrl(s.figure, s.action));
    return [...new Set(list)];
  }, [walkers, standers]);
  const clips = useCompactClips(clipNames);
  const clipFor = (url: string) => clips[clipNames.indexOf(url)];

  const people = useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const out: Person[] = [];
    const sourceFor = (figure: string) => sources[figureIds.indexOf(figure)];
    const speedCache = new Map<string, number>();
    for (const w of walkers) {
      const figure = figureById(w.figure)!;
      const clip = clipFor(clipUrl(w.figure, w.gait));
      const p = makePerson(w.id, sourceFor(w.figure), figure, clip, cache);
      const key = `${w.figure}/${w.gait}`;
      if (!speedCache.has(key)) speedCache.set(key, strideSpeed(p.model, clip));
      out.push({ id: w.id, root: p.root, mixer: p.mixer, walker: w, speed: speedCache.get(key)!, distance: w.startDistance, heading: 0 });
    }
    for (const s of standers as StreetStander[]) {
      const figure = figureById(s.figure)!;
      const p = makePerson(s.id, sourceFor(s.figure), figure, clipFor(clipUrl(s.figure, s.action)), cache);
      p.root.position.set(s.position[0], streetGroundHeight(s.position[0], s.position[1]), s.position[1]);
      p.root.rotation.y = s.heading;
      out.push({ id: s.id, root: p.root, mixer: p.mixer, speed: 0, distance: 0, heading: s.heading });
    }
    return out;
    // clipFor depende de clips/clipNames, ya en la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkers, standers, sources, figureIds, clips, clipNames]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") (globalThis as Record<string, unknown>).__codPeople = people;
  }, [people]);

  const subjects = useRef<MovingSubjectState[]>([]);
  useEffect(() => {
    subjects.current = people.map((p) => ({
      id: `${STREET_PERSON_ID_PREFIX}${p.id}`,
      subjectKind: "human",
      position: [p.root.position.x, CHEST_Y, p.root.position.z],
      speed: p.speed,
      direction: 1,
      velocityX: 0,
      visible: true,
    }));
    // Se suman a lo ya registrado (por ejemplo, los autos del tránsito).
    const others = () => simulatorRuntime.movingSubjects.filter((x) => !x.id.startsWith(STREET_PERSON_ID_PREFIX));
    syncMovingSubjectsRegistry([...others(), ...subjects.current]);
    return () => {
      syncMovingSubjectsRegistry(others());
      for (const p of people) p.mixer.stopAllAction();
    };
  }, [people]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (streetRuntime.walkers.length !== people.length) {
      streetRuntime.walkers = people.map(() => [0, 0] as [number, number]);
    }
    people.forEach((p, i) => {
      p.mixer.update(dt);
      if (p.walker) {
        p.distance += p.speed * dt;
        const at = samplePath(p.walker.path, p.distance);
        // Gira suave en las puntas y esquinas (no da media vuelta en un cuadro).
        const diff = Math.atan2(Math.sin(at.heading - p.heading), Math.cos(at.heading - p.heading));
        p.heading += diff * Math.min(1, dt * 6);
        p.root.position.set(at.x, streetGroundHeight(at.x, at.z), at.z);
        p.root.rotation.y = p.heading;
      }
      (streetRuntime.walkers[i] as [number, number])[0] = p.root.position.x;
      (streetRuntime.walkers[i] as [number, number])[1] = p.root.position.z;
      const s = subjects.current[i];
      if (s) {
        s.position[0] = p.root.position.x;
        s.position[1] = p.root.position.y + CHEST_Y;
        s.position[2] = p.root.position.z;
        s.velocity = p.walker ? [Math.sin(p.heading) * p.speed, 0, Math.cos(p.heading) * p.speed] : [0, 0, 0];
        s.velocityX = s.velocity[0];
      }
    });
  });

  return (
    <group>
      {people.map((p) => (
        <primitive key={p.id} object={p.root} />
      ))}
    </group>
  );
}
