"use client";

import { simulatorRuntime, syncMovingSubjectsRegistry } from "@/lib/simulator/simulator-runtime";
import type { MovingSubjectState } from "@/lib/simulator/moving-subject-types";
import { STREET_PERSON_ID_PREFIX } from "@/lib/simulator/moving-subject-types";
import { ANIMATION_DIR, decodeClip, stripRootMotion, type CompactClip } from "@/lib/simulator/studio-light/animation-clip";
import { figureById, type FigureSpec } from "@/lib/simulator/studio-light/figures";
import { streetGroundHeight, type StreetLayout } from "@/lib/simulator/street/street-layout";
import { streetRuntime } from "@/lib/simulator/street/street-runtime";
import {
  closestDistanceOnPath,
  isRunning,
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
import { createEyeState, lidFollow, stepEyes, vergence, type EyeState } from "@/lib/simulator/face/eye-motion";
import { seededRandom } from "@/lib/simulator/street/street-layout";
import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { avatarUrl, instantiateAvatar, prepareAvatarLoader } from "./street-avatar";
import { isTouchGameDevice } from "@/lib/simulator/touch-input";

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

/** Más allá de esto la gente no se dibuja ni se anima (queda en la bruma). */
const PEOPLE_DRAW_DISTANCE = 85;
/** Celular: cada persona son 8 a 14 llamadas de dibujo; de lejos no aportan y frenan mucho. */
const MOBILE_PEOPLE_DRAW_DISTANCE = 45;

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
  /** Ojos: saltos y pausas como los de una persona (ver eye-motion). */
  eyes: EyeState;
  eyeRand: () => number;
  /** Giro actual de la cabeza hacia lo que mira (grados): la cabeza llega después que los ojos. */
  headAim: { yaw: number; pitch: number };
  /** Último parpadeo pedido por un salto grande de los ojos (s del reloj). */
  blinkAt: number;
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
  const { root, model } = instantiateAvatar(source, figure, cache, `${STREET_PERSON_ID_PREFIX}${id}`);
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
/**
 * La cabeza gira (cuello y cabeza) hacia donde se le pidió mirar, pero
 * despacio: los ojos llegan primero y la cabeza los alcanza. Devuelve hacia
 * dónde quiere mirar en total y cuánto ya giró la cabeza (grados, marco del cuerpo).
 */
function aimHead(p: Person, camera: THREE.Camera, gazeYawDeg: number, gazePitchDeg: number, dt: number) {
  const head = p.model.getObjectByName("Bip01_Head");
  const neck = p.model.getObjectByName("Bip01_Neck");
  if (!head || !neck) return null;
  p.root.updateMatrixWorld(true);
  head.getWorldPosition(_headPos);
  const toCamera = Math.atan2(camera.position.x - _headPos.x, camera.position.z - _headPos.z);
  const look = toCamera - (gazeYawDeg * Math.PI) / 180;
  const horizontal = Math.hypot(camera.position.x - _headPos.x, camera.position.z - _headPos.z);
  const totalYaw = THREE.MathUtils.radToDeg(Math.atan2(Math.sin(look - p.heading), Math.cos(look - p.heading)));
  const totalPitch = THREE.MathUtils.radToDeg(Math.atan2(camera.position.y - _headPos.y, horizontal)) + gazePitchDeg;
  const wantYaw = THREE.MathUtils.clamp(totalYaw, -GAZE_LIMIT_YAW, GAZE_LIMIT_YAW);
  const wantPitch = THREE.MathUtils.clamp(totalPitch, -GAZE_LIMIT_PITCH, GAZE_LIMIT_PITCH);
  // La cabeza tarda unos 300 ms en acomodarse (los ojos, 50 ms).
  const k = 1 - Math.exp(-dt / 0.3);
  p.headAim.yaw += (wantYaw - p.headAim.yaw) * k;
  p.headAim.pitch += (wantPitch - p.headAim.pitch) * k;
  const yaw = THREE.MathUtils.degToRad(p.headAim.yaw);
  const pitch = THREE.MathUtils.degToRad(p.headAim.pitch);
  // Giro en el marco del cuerpo: yaw alrededor de la vertical, pitch alrededor del eje lateral.
  _qBody.setFromAxisAngle(_up, p.heading);
  for (const [bone, share] of [[neck, 0.4], [head, 0.6]] as const) {
    _q.setFromAxisAngle(_up, yaw * share).multiply(new THREE.Quaternion().setFromAxisAngle(_side, -pitch * share));
    // Del marco del cuerpo al mundo: q_mundo = cuerpo · q · cuerpo⁻¹.
    const world = _qBody.clone().multiply(_q).multiply(_qBody.clone().invert());
    rotateBoneWorld(bone, world);
  }
  return { yaw: totalYaw, pitch: totalPitch, headYaw: p.headAim.yaw, headPitch: p.headAim.pitch, distance: camera.position.distanceTo(_headPos) };
}

/** Más lejos que esto los paseantes no "ven" la cámara (no la miran). */
const NOTICE_CAMERA = 12;

/**
 * Ojos: saltos rápidos y pausas como los de una persona. `fixate` es lo que
 * mira (relativo a la cabeza, grados); sin eso mira alrededor y a veces a la cámara.
 */
function moveEyes(p: Person, camera: THREE.Camera, now: number, dt: number, fixate: [number, number] | null, distance: number) {
  const head = p.model.getObjectByName("Bip01_Head");
  if (!head) return;
  head.getWorldPosition(_headPos);
  const dx = camera.position.x - _headPos.x;
  const dz = camera.position.z - _headPos.z;
  const yaw = THREE.MathUtils.radToDeg(Math.atan2(Math.sin(Math.atan2(dx, dz) - p.heading), Math.cos(Math.atan2(dx, dz) - p.heading)));
  const pitch = THREE.MathUtils.radToDeg(Math.atan2(camera.position.y - _headPos.y, Math.hypot(dx, dz)));
  const seen = Math.hypot(dx, dz) < NOTICE_CAMERA && Math.abs(yaw) < 60;
  stepEyes(p.eyes, { fixate, camera: seen ? [yaw, pitch] : null }, now, dt, p.eyeRand);
  if (p.eyes.blinkRequest) {
    p.eyes.blinkRequest = false;
    p.blinkAt = now;
  }
  _qBody.setFromAxisAngle(_up, p.heading);
  const verge = vergence(distance);
  for (const [name, inward] of [["Bip01_LEye", -1], ["Bip01_REye", 1]] as const) {
    const eye = p.model.getObjectByName(name);
    if (!eye) continue;
    // Las animaciones no mueven los ojos: sin volver a la posición de reposo, cada
    // cuadro se sumaría al anterior y los ojos se irían para cualquier lado.
    const rest = (eye.userData.restQuaternion ??= eye.quaternion.clone()) as THREE.Quaternion;
    eye.quaternion.copy(rest);
    eye.updateMatrixWorld(true);
    const y = THREE.MathUtils.degToRad(p.eyes.yaw + inward * verge);
    const x = THREE.MathUtils.degToRad(p.eyes.pitch);
    _q.setFromAxisAngle(_up, y).multiply(new THREE.Quaternion().setFromAxisAngle(_side, -x));
    rotateBoneWorld(eye, _qBody.clone().multiply(_q).multiply(_qBody.clone().invert()));
  }
}

/** Parpadeo que acompaña un salto grande de los ojos (0 abierto … 1 cerrado). */
function saccadeBlink(sinceS: number): number {
  const x = sinceS / 0.15;
  if (x < 0 || x > 1) return 0;
  return x < 0.4 ? x / 0.4 : 1 - (x - 0.4) / 0.6;
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

  // Parpadeo propio, el que acompaña los saltos grandes y el párpado que sigue a la mirada.
  const blink = Math.min(1, Math.max(blinkWeight(now, p.faceSeed), saccadeBlink(now - p.blinkAt)) + lidFollow(p.eyes.pitch));
  // Con la sonrisa los párpados ya bajan un poco: el parpadeo completa el resto.
  const eyes: FaceWeights = { AK_09_EyeBlinkLeft: blink, AK_10_EyeBlinkRight: blink };
  applyFaceWeights(p.face, mixWeights(next, mouth, eyes));
}

/** Cuánto avanza la raíz en un ciclo, en m/s (el esqueleto está en centímetros). */
function rootSpeed(clip: THREE.AnimationClip): number {
  const v = clip.tracks.find((t) => t.name === "Bip01.position")?.values;
  if (!v || clip.duration <= 0) return 0;
  const n = v.length - 3;
  return Math.hypot(v[n] - v[0], v[n + 2] - v[2]) / 100 / clip.duration;
}

function useCompactClips(urls: string[]): THREE.AnimationClip[] {
  const texts = useLoader(THREE.FileLoader, urls) as unknown as string[];
  return useMemo(
    () =>
      texts.map((t) => {
        const clip = decodeClip(JSON.parse(t) as CompactClip);
        // Antes de dejarla en el lugar: el avance real sirve de velocidad al correr.
        clip.userData.rootSpeed = rootSpeed(clip);
        return stripRootMotion(clip);
      }),
    [texts],
  );
}

export default function StreetPedestrians({ layout }: { layout: StreetLayout }) {
  const { walkers, standers } = useMemo(() => planStreetPeople(layout, isTouchGameDevice()), [layout]);
  const figureIds = useMemo(
    () => [...new Set([...walkers, ...standers].map((p) => p.figure))],
    [walkers, standers],
  );
  const specs = useMemo(() => figureIds.map((id) => figureById(id)!), [figureIds]);
  const sources = useLoader(
    FBXLoader,
    specs.map(avatarUrl),
    prepareAvatarLoader,
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
      // Al correr el pie apoya mucho menos tiempo: la zancada no sirve, sí el avance del clip.
      if (!speedCache.has(key)) speedCache.set(key, isRunning(w.gait) ? (clip.userData.rootSpeed as number) : strideSpeed(p.model, clip));
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
        eyes: createEyeState(),
        eyeRand: seededRandom(out.length * 13 + 5),
        headAim: { yaw: 0, pitch: 0 },
        blinkAt: -10,
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
        eyes: createEyeState(),
        eyeRand: seededRandom(out.length * 13 + 5),
        headAim: { yaw: 0, pitch: 0 },
        blinkAt: -10,
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
        p.headAim = { yaw: 0, pitch: 0 };
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

      // Lejos no se dibuja ni se anima (sigue caminando su recorrido igual).
      const far = !isModel && p.root.position.distanceTo(camera.position) > (simulatorRuntime.quality.mobile ? MOBILE_PEOPLE_DRAW_DISTANCE : PEOPLE_DRAW_DISTANCE);
      p.root.visible = !far;
      if (!far) {
        // Velocidad pedida ("saludá rápido"); al caminar o al soltarlo, la natural.
        p.current.timeScale = isModel && !p.move ? st.pose.tempo : 1;
        p.mixer.update(dt);
        const aim = isModel && !FREE_HEAD.has(st.pose.action) ? aimHead(p, camera, st.pose.gazeYaw, st.pose.gazePitch, dt) : null;
        const near = p.root.position.distanceTo(camera.position);
        if (near < FACE_DISTANCE) {
          // Lo que le falta girar a la cabeza lo completan los ojos (lo que mira, relativo a la cabeza).
          const fixate: [number, number] | null = aim ? [aim.yaw - aim.headYaw, aim.pitch - aim.headPitch] : null;
          moveEyes(p, camera, clock.elapsedTime, dt, fixate, aim?.distance ?? near);
        }
        updateFace(p, isModel, st, camera, clock.elapsedTime, dt);
      }
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
    <group name="calle-gente">
      {people.map((p) => (
        <primitive key={p.id} object={p.root} />
      ))}
    </group>
  );
}
