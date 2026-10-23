"use client";

import { simulatorRuntime, syncMovingSubjectsRegistry } from "@/lib/simulator/simulator-runtime";
import type { MovingSubjectState } from "@/lib/simulator/moving-subject-types";
import { STREET_PERSON_ID_PREFIX } from "@/lib/simulator/moving-subject-types";
import { ANIMATION_DIR, decodeClip, type CompactClip } from "@/lib/simulator/studio-light/animation-clip";
import { figureById, figureUrl, type FigureSpec } from "@/lib/simulator/studio-light/figures";
import { streetGroundHeight, type StreetLayout } from "@/lib/simulator/street/street-layout";
import { streetRuntime } from "@/lib/simulator/street/street-runtime";
import {
  closestDistanceOnPath,
  isWoman,
  planStreetPeople,
  samplePath,
  type StreetStander,
  type StreetWalker,
} from "@/lib/simulator/street/street-people";
import { bodyHeading, GAZE_LIMIT_PITCH, GAZE_LIMIT_YAW } from "@/lib/simulator/street/model-direction";
import { modelStore } from "@/lib/simulator/street/model-store";
import {
  EXPRESSION_WEIGHTS,
  blinkWeight,
  mixWeights,
  speechDuration,
  speechWeights,
  type Expression,
  type FaceShape,
  type FaceWeights,
} from "@/lib/simulator/face/face-expressions";
import { applyFaceWeights, findFaceMesh, pruneFaceShapes } from "@/lib/simulator/face/face-rig";
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
/** Se le puede hablar a quien está a menos de esta distancia y cerca del centro del cuadro. */
const TALK_DISTANCE = 9;
const TALK_ANGLE = (10 * Math.PI) / 180;
/** Más cerca que esto la persona no se acerca (m). */
const MODEL_MIN_DISTANCE = 1.2;
/** Más lejos que esto la cara no se anima (no se ve y ahorra trabajo). */
const FACE_DISTANCE = 25;
/** Lo que "dice" alguien que habla en una acción de charla. */
const SMALL_TALK = "mira vos que lindo dia hoy no te parece que esta para sacar fotos";

/** Acciones en las que la cabeza va con la animación (no mira a la cámara). */
const FREE_HEAD = new Set(["idle_look_around_01", "cell_phone_textmessage"]);

/** Clips que se piden recién cuando un modelo los necesita. */
const clipCache = new Map<string, Promise<THREE.AnimationClip>>();
function loadClip(url: string): Promise<THREE.AnimationClip> {
  let hit = clipCache.get(url);
  if (!hit) {
    hit = fetch(url)
      .then((r) => r.json() as Promise<CompactClip>)
      .then(decodeClip);
    clipCache.set(url, hit);
  }
  return hit;
}

const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();
const _qBone = new THREE.Quaternion();
const _qBody = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3(1, 0, 0);
const _headPos = new THREE.Vector3();

/** Gira un hueso en el mundo (después de la animación) conservando su jerarquía. */
function rotateBoneWorld(bone: THREE.Object3D, delta: THREE.Quaternion) {
  bone.getWorldQuaternion(_qBone);
  bone.parent?.getWorldQuaternion(_qParent);
  _qBone.premultiply(delta);
  bone.quaternion.copy(_qParent.invert().multiply(_qBone));
  bone.updateMatrixWorld(true);
}

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
  name: string;
  figure: string;
  root: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  /** Animación de base (caminar o la acción de quien está quieto). */
  base: THREE.AnimationAction;
  /** Animación que está sonando ahora. */
  current: THREE.AnimationAction;
  /** Acción pedida como modelo (null = no está posando). */
  posing: string | null;
  /** Traslado pedido como modelo ("acercate"). */
  move: { from: THREE.Vector3; to: THREE.Vector3; t: number; seconds: number } | null;
  /** Cara: malla con formas, ritmo de parpadeo y pesos actuales (suavizados). */
  face: THREE.Mesh | null;
  faceSeed: number;
  faceNow: FaceWeights;
  /** Expresión de quien camina (algunos van con una sonrisa leve). */
  idleExpression: Expression;
  /** Lo último que dijo y cuándo empezó a decirlo (s del reloj de la escena). */
  speech: { text: string; start: number; replyAt: number } | null;
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
): { root: THREE.Group; mixer: THREE.AnimationMixer; model: THREE.Object3D; action: THREE.AnimationAction } {
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
  return { root, mixer, model, action };
}

/**
 * Orienta cuello y cabeza hacia la cámara (más el desvío pedido), después de
 * la animación. El cuello hace el 40 % del giro y la cabeza el resto.
 */
function aimHead(p: Person, camera: THREE.Camera, gazeYawDeg: number, gazePitchDeg: number) {
  const head = p.model.getObjectByName("Bip01_Head");
  const neck = p.model.getObjectByName("Bip01_Neck");
  if (!head || !neck) return;
  p.root.updateMatrixWorld(true);
  head.getWorldPosition(_headPos);
  const toCamera = Math.atan2(camera.position.x - _headPos.x, camera.position.z - _headPos.z);
  const look = toCamera - (gazeYawDeg * Math.PI) / 180;
  const limitYaw = (GAZE_LIMIT_YAW * Math.PI) / 180;
  const limitPitch = (GAZE_LIMIT_PITCH * Math.PI) / 180;
  const yaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(look - p.heading), Math.cos(look - p.heading)), -limitYaw, limitYaw);
  const horizontal = Math.hypot(camera.position.x - _headPos.x, camera.position.z - _headPos.z);
  const pitch = THREE.MathUtils.clamp(
    Math.atan2(camera.position.y - _headPos.y, horizontal) + (gazePitchDeg * Math.PI) / 180,
    -limitPitch,
    limitPitch,
  );
  // Giro en el marco del cuerpo: yaw alrededor de la vertical, pitch alrededor del eje lateral.
  _qBody.setFromAxisAngle(_up, p.heading);
  for (const [bone, share] of [[neck, 0.4], [head, 0.6]] as const) {
    _q.setFromAxisAngle(_up, yaw * share).multiply(new THREE.Quaternion().setFromAxisAngle(_side, -pitch * share));
    // Del marco del cuerpo al mundo: q_mundo = cuerpo · q · cuerpo⁻¹.
    const world = _qBody.clone().multiply(_q).multiply(_qBody.clone().invert());
    rotateBoneWorld(bone, world);
  }
  // Los ojos completan lo que el cuello no llega a girar (hasta ~25°).
  const rawYaw = Math.atan2(Math.sin(look - p.heading), Math.cos(look - p.heading));
  const restYaw = THREE.MathUtils.clamp(rawYaw - yaw, -0.45, 0.45);
  if (Math.abs(restYaw) > 0.01) {
    const eyeTurn = _qBody.clone().multiply(new THREE.Quaternion().setFromAxisAngle(_up, restYaw)).multiply(_qBody.clone().invert());
    for (const name of ["Bip01_LEye", "Bip01_REye"]) {
      const eye = p.model.getObjectByName(name);
      if (eye) rotateBoneWorld(eye, eyeTurn);
    }
  }
}

/**
 * Cara viva: parpadeo propio de cada persona, expresión con transición suave
 * y boca que se mueve al hablar. Lejos de la cámara no se calcula.
 */
function updateFace(
  p: Person,
  isModel: boolean,
  st: ReturnType<typeof modelStore.getState>,
  camera: THREE.Camera,
  now: number,
  dt: number,
) {
  if (!p.face) return;
  const far = p.root.position.distanceTo(camera.position) > FACE_DISTANCE;
  if (far && !isModel) return;

  // Lo que contesta el modelo se ve en la boca.
  if (isModel && st.reply && st.replyAt !== p.speech?.replyAt) {
    p.speech = { text: st.reply, start: now, replyAt: st.replyAt };
  }
  if (!isModel) p.speech = null;
  const talking = isModel && st.pose.action === "gestic_talk_relaxed_01";
  let mouth: FaceWeights = {};
  if (p.speech && now - p.speech.start < speechDuration(p.speech.text)) {
    mouth = speechWeights(p.speech.text, now - p.speech.start);
  } else if (talking) {
    const loop = speechDuration(SMALL_TALK) + 0.6;
    mouth = speechWeights(SMALL_TALK, (now + p.faceSeed) % loop);
  }

  // Expresión: la pedida, o la propia de quien camina. Reírse arrastra la cara de risa.
  let expression: Expression = isModel ? st.pose.expression : p.idleExpression;
  if (isModel && expression === "neutral" && st.pose.action === "gestic_laugh_low") expression = "laugh";
  const target = EXPRESSION_WEIGHTS[expression];
  const k = 1 - Math.exp(-dt * 6);
  const next: FaceWeights = {};
  const keys = new Set([...Object.keys(target), ...Object.keys(p.faceNow)]) as Set<FaceShape>;
  for (const key of keys) {
    const v = (p.faceNow[key] ?? 0) + ((target[key] ?? 0) - (p.faceNow[key] ?? 0)) * k;
    if (v > 0.002) next[key] = v;
  }
  p.faceNow = next;

  const blink = blinkWeight(now, p.faceSeed);
  // Con la sonrisa los párpados ya bajan un poco: el parpadeo completa el resto.
  const eyes: FaceWeights = { AK_09_EyeBlinkLeft: blink, AK_10_EyeBlinkRight: blink };
  applyFaceWeights(p.face, mixWeights(next, mouth, eyes));
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
    specs.map((f) => figureUrl(f, "model-facial.fbx")),
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
    for (const source of sources) pruneFaceShapes(source);
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
      out.push({
        id: w.id,
        name: figure.name,
        figure: w.figure,
        root: p.root,
        model: p.model,
        mixer: p.mixer,
        base: p.action,
        current: p.action,
        posing: null,
        move: null,
        face: findFaceMesh(p.model),
        faceSeed: out.length * 7.31 + 1,
        faceNow: {},
        idleExpression: out.length % 3 === 0 ? "smile" : "neutral",
        speech: null,
        walker: w,
        speed: speedCache.get(key)!,
        distance: w.startDistance,
        heading: 0,
      });
    }
    for (const s of standers as StreetStander[]) {
      const figure = figureById(s.figure)!;
      const p = makePerson(s.id, sourceFor(s.figure), figure, clipFor(clipUrl(s.figure, s.action)), cache);
      p.root.position.set(s.position[0], streetGroundHeight(s.position[0], s.position[1]), s.position[1]);
      p.root.rotation.y = s.heading;
      out.push({
        id: s.id,
        name: figure.name,
        figure: s.figure,
        root: p.root,
        model: p.model,
        mixer: p.mixer,
        base: p.action,
        current: p.action,
        posing: null,
        move: null,
        face: findFaceMesh(p.model),
        faceSeed: out.length * 7.31 + 1,
        faceNow: {},
        idleExpression: out.length % 3 === 0 ? "smile" : "neutral",
        speech: null,
        speed: 0,
        distance: 0,
        heading: s.heading,
      });
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
    // La limpieza de abajo frena todo: al volver a montar (React lo hace dos
    // veces en desarrollo) hay que arrancar de nuevo cada animación.
    for (const p of people) p.current.play();
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

  /** Pasa suavemente de una animación a otra. */
  const crossfade = (p: Person, next: THREE.AnimationAction) => {
    if (p.current === next) return;
    next.reset().play();
    p.current.crossFadeTo(next, 0.4, false);
    p.current = next;
  };

  useEffect(() => () => modelStore.setNearby(null), []);

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 0.1);
    const st = modelStore.getState();

    // ¿A quién estamos mirando? (para poder hablarle)
    camera.getWorldDirection(_fwd);
    let nearby: { p: Person; angle: number; dist: number } | null = null;
    for (const p of people) {
      _to.set(p.root.position.x - camera.position.x, p.root.position.y + CHEST_Y - camera.position.y, p.root.position.z - camera.position.z);
      const dist = _to.length();
      if (dist > TALK_DISTANCE || dist < 0.3) continue;
      const angle = _to.angleTo(_fwd);
      if (angle < TALK_ANGLE && (!nearby || angle < nearby.angle)) nearby = { p, angle, dist };
    }
    modelStore.setNearby(nearby ? { id: nearby.p.id, name: nearby.p.name, distance: nearby.dist } : null);
    if (streetRuntime.walkers.length !== people.length) {
      streetRuntime.walkers = people.map(() => [0, 0] as [number, number]);
    }
    people.forEach((p, i) => {
      const isModel = st.model?.id === p.id;

      // Deja de posar: vuelve a su animación y retoma el circuito donde quedó.
      if (!isModel && p.posing) {
        p.posing = null;
        p.move = null;
        crossfade(p, p.base);
        if (p.walker) p.distance = closestDistanceOnPath(p.walker.path, p.root.position.x, p.root.position.z);
      }

      if (isModel) {
        // Acción pedida (el clip se baja la primera vez que se usa).
        if (p.posing !== st.pose.action) {
          p.posing = st.pose.action;
          const wanted = p.posing;
          loadClip(clipUrl(p.figure, wanted)).then((clip) => {
            if (p.posing === wanted) crossfade(p, p.mixer.clipAction(clip));
          });
        }
        // "Acercate" / "alejate": camina en línea recta respecto de la cámara.
        if (!p.move) {
          const meters = modelStore.takeMove();
          if (meters !== null) {
            const from = p.root.position.clone();
            _to.set(from.x - camera.position.x, 0, from.z - camera.position.z);
            const current = _to.length();
            const target = Math.max(MODEL_MIN_DISTANCE, current + meters);
            _to.normalize().multiplyScalar(target - current);
            const to = from.clone().add(_to);
            to.y = streetGroundHeight(to.x, to.z);
            p.move = { from, to, t: 0, seconds: Math.max(0.6, Math.abs(target - current) / 1.1) };
            if (p.walker) crossfade(p, p.base);
          }
        }
        if (p.move) {
          p.move.t = Math.min(1, p.move.t + dt / p.move.seconds);
          p.root.position.lerpVectors(p.move.from, p.move.to, p.move.t);
          if (p.move.t >= 1) {
            p.move = null;
            const wanted = p.posing;
            if (wanted) loadClip(clipUrl(p.figure, wanted)).then((clip) => p.posing === wanted && crossfade(p, p.mixer.clipAction(clip)));
          }
        }
        // El cuerpo gira hacia donde se le pidió, respecto de la cámara.
        const target = bodyHeading({ x: p.root.position.x, z: p.root.position.z }, { x: camera.position.x, z: camera.position.z }, st.pose.facing);
        const diff = Math.atan2(Math.sin(target - p.heading), Math.cos(target - p.heading));
        p.heading += diff * Math.min(1, dt * 3);
        p.root.rotation.y = p.heading;
      }

      // Velocidad pedida ("saludá rápido"); al caminar o al soltarlo, la natural.
      p.current.timeScale = isModel && !p.move ? st.pose.tempo : 1;
      p.mixer.update(dt);
      if (isModel && !FREE_HEAD.has(st.pose.action)) aimHead(p, camera, st.pose.gazeYaw, st.pose.gazePitch);
      updateFace(p, isModel, st, camera, clock.elapsedTime, dt);
      if (p.walker && !isModel) {
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
        const walking = p.walker && !isModel;
        s.velocity = walking ? [Math.sin(p.heading) * p.speed, 0, Math.cos(p.heading) * p.speed] : [0, 0, 0];
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
