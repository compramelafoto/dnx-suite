"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { SUBJECT_HEAD } from "@/lib/simulator/studio-light/metering";
import { SET_BOUNDS, useStudio } from "@/lib/simulator/studio-light/studio-store";

/** Objetivos que se recorren con la rueda en primera persona (como un zoom). */
export const WALK_FOCALS = [24, 35, 50, 70, 85, 105, 135, 200];

const WALK_SPEED = 1.7;
const SPRINT_SPEED = 3.2;
const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = 1.45;
const HEIGHT_MIN = 0.45;
const HEIGHT_MAX = 2.4;
/** Distancia mínima al sujeto: no se lo puede atravesar. */
const SUBJECT_RADIUS = 0.5;

function lookTowards(from: THREE.Vector3, to: THREE.Vector3): { yaw: number; pitch: number } {
  const d = to.clone().sub(from);
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
}

interface Held {
  id: string;
  /** Distancia horizontal y ángulo relativo a la mirada al agarrar la luz. */
  dist: number;
  angle: number;
}

/**
 * Fotógrafo en primera persona: W A S D para caminar, mouse para mirar, rueda
 * para el zoom, Q/E para bajar o subir la cámara, clic para disparar y F para
 * agarrar o soltar la luz que está en la mira.
 */
export function StudioWalkController({
  active,
  photoCam,
  onShoot,
}: {
  active: boolean;
  photoCam: THREE.PerspectiveCamera;
  onShoot: () => void;
}) {
  const { state, dispatch } = useStudio();
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const pos = useRef(new THREE.Vector3());
  const look = useRef({ yaw: 0, pitch: 0 });
  const keys = useRef(new Set<string>());
  const held = useRef<Held | null>(null);
  const lastSync = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  // El disparo cambia en cada redibujado; si fuera dependencia del efecto,
  // re-suscribirse liberaría el mouse a cada rato.
  const shootRef = useRef(onShoot);
  shootRef.current = onShoot;

  // Al entrar al modo se parte de donde está la cámara del set.
  useEffect(() => {
    if (!active) return;
    const c = stateRef.current.camera;
    pos.current.set(c.x, c.y, c.z);
    look.current = c.look ?? lookTowards(pos.current, new THREE.Vector3(SUBJECT_HEAD[0], c.aimY, SUBJECT_HEAD[2]));
    held.current = null;
  }, [active]);

  /** Agarra la luz que está en el centro de la mira, o suelta la que se lleva. */
  function toggleGrab() {
    if (held.current) {
      held.current = null;
      return;
    }
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), photoCam);
    for (const hit of raycaster.intersectObjects(scene.children, true)) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.studioLightId) o = o.parent;
      if (!o) continue;
      const light = stateRef.current.lights.find((l) => l.id === o.userData.studioLightId);
      if (!light) return;
      const dx = light.x - pos.current.x;
      const dz = light.z - pos.current.z;
      const angle = Math.atan2(-dx, -dz) - look.current.yaw;
      held.current = { id: light.id, dist: Math.max(0.8, Math.hypot(dx, dz)), angle };
      dispatch({ type: "select", id: light.id });
      return;
    }
  }

  useEffect(() => {
    if (!active) return;
    const canvas = gl.domElement;
    const pressed = keys.current;
    const locked = () => document.pointerLockElement === canvas;

    // Sin mouse capturado también se puede mirar arrastrando (touchpad, o si el
    // navegador no permite capturarlo). Un clic sin arrastre intenta capturarlo.
    const drag = { on: false, moved: false, x: 0, y: 0 };
    const turn = (dx: number, dy: number) => {
      look.current.yaw -= dx * LOOK_SENSITIVITY;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - dy * LOOK_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (locked()) {
        shootRef.current();
        return;
      }
      Object.assign(drag, { on: true, moved: false, x: e.clientX, y: e.clientY });
    };
    const onMouseMove = (e: MouseEvent) => {
      if (locked()) {
        turn(e.movementX, e.movementY);
        return;
      }
      if (!drag.on) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      turn(dx, dy);
    };
    const onMouseUp = () => {
      if (drag.on && !drag.moved) {
        // requestPointerLock devuelve una promesa que falla si la ventana no tiene el foco.
        const request = canvas.requestPointerLock?.() as Promise<void> | undefined;
        request?.catch?.(() => undefined);
      }
      drag.on = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (!locked()) return;
      e.preventDefault();
      const focal = stateRef.current.camera.focalMm;
      const i = WALK_FOCALS.findIndex((f) => f >= focal);
      const next = WALK_FOCALS[THREE.MathUtils.clamp((i < 0 ? WALK_FOCALS.length - 1 : i) + (e.deltaY < 0 ? 1 : -1), 0, WALK_FOCALS.length - 1)];
      dispatch({ type: "camera", patch: { focalMm: next } });
    };
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA");
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "KeyF") {
        toggleGrab();
        return;
      }
      pressed.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => pressed.delete(e.code);
    const onBlur = () => pressed.clear();

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
      document.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      pressed.clear();
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    };
    // toggleGrab lee refs: no hace falta re-suscribir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, gl, dispatch]);

  useFrame((_, delta) => {
    if (!active) return;
    const k = keys.current;
    const dt = Math.min(delta, 0.05);
    const speed = (k.has("ShiftLeft") || k.has("ShiftRight") ? SPRINT_SPEED : WALK_SPEED) * dt;
    const { yaw, pitch } = look.current;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const p = pos.current;
    if (k.has("KeyW") || k.has("ArrowUp")) p.addScaledVector(fwd, speed);
    if (k.has("KeyS") || k.has("ArrowDown")) p.addScaledVector(fwd, -speed);
    if (k.has("KeyD") || k.has("ArrowRight")) p.addScaledVector(right, speed);
    if (k.has("KeyA") || k.has("ArrowLeft")) p.addScaledVector(right, -speed);
    if (k.has("KeyE")) p.y += 0.9 * dt;
    if (k.has("KeyQ")) p.y -= 0.9 * dt;
    p.x = THREE.MathUtils.clamp(p.x, SET_BOUNDS.minX, SET_BOUNDS.maxX);
    p.z = THREE.MathUtils.clamp(p.z, SET_BOUNDS.minZ + 0.4, SET_BOUNDS.maxZ);
    p.y = THREE.MathUtils.clamp(p.y, HEIGHT_MIN, HEIGHT_MAX);
    const r = Math.hypot(p.x, p.z);
    if (r < SUBJECT_RADIUS) {
      const s = SUBJECT_RADIUS / Math.max(r, 1e-4);
      p.x *= s;
      p.z *= s;
    }

    photoCam.position.copy(p);
    photoCam.rotation.set(pitch, yaw, 0, "YXZ");

    const now = performance.now();
    if (now - lastSync.current > 110) {
      lastSync.current = now;
      dispatch({ type: "camera-move", patch: { x: p.x, y: p.y, z: p.z, look: { yaw, pitch } } });
      const h = held.current;
      if (h) {
        const a = yaw + h.angle;
        dispatch({ type: "move-light", id: h.id, x: p.x - Math.sin(a) * h.dist, z: p.z - Math.cos(a) * h.dist });
      }
    }
  });

  return null;
}

export type QuickView = "overview" | "front" | "side" | "top" | "camera" | "subject";

/** Mueve la cámara del set a vistas prefijadas con una transición suave. */
export function StudioCameraDirector({ requestRef }: { requestRef: MutableRefObject<((v: QuickView) => void) | null> }) {
  const { state } = useStudio();
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const anim = useRef<{ fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; t: number } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    requestRef.current = (v: QuickView) => {
      if (!controls) return;
      const c = stateRef.current.camera;
      const views: Record<QuickView, [THREE.Vector3, THREE.Vector3]> = {
        overview: [new THREE.Vector3(4.2, 3.1, 5.2), new THREE.Vector3(0, 1.25, 0)],
        front: [new THREE.Vector3(0, 1.7, 6.2), new THREE.Vector3(0, 1.3, 0)],
        side: [new THREE.Vector3(6.2, 1.8, 0.6), new THREE.Vector3(0, 1.3, 0.6)],
        top: [new THREE.Vector3(0, 9.5, 1.3), new THREE.Vector3(0, 0, 1.2)],
        camera: [
          new THREE.Vector3(c.x, c.y + 0.25, c.z).add(new THREE.Vector3(c.x, 0, c.z).normalize().multiplyScalar(0.9)),
          new THREE.Vector3(SUBJECT_HEAD[0], c.aimY, SUBJECT_HEAD[2]),
        ],
        subject: [new THREE.Vector3(1.6, 1.85, 2.4), new THREE.Vector3(0, 1.45, 0)],
      };
      const [toPos, toTarget] = views[v];
      anim.current = { fromPos: camera.position.clone(), toPos, fromTarget: controls.target.clone(), toTarget, t: 0 };
    };
    return () => {
      requestRef.current = null;
    };
  }, [camera, controls, requestRef]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + delta / 0.6);
    const k = 1 - Math.pow(1 - a.t, 3);
    camera.position.lerpVectors(a.fromPos, a.toPos, k);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });

  return null;
}
