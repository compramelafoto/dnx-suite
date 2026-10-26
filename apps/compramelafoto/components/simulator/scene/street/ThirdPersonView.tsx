"use client";

import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { ANIMATION_DIR, decodeClip, stripRootMotion, type CompactClip } from "@/lib/simulator/studio-light/animation-clip";
import { figureById } from "@/lib/simulator/studio-light/figures";
import { isWoman } from "@/lib/simulator/street/street-people";
import { thirdPersonStore } from "@/lib/simulator/street/third-person";
import { touchInput } from "@/lib/simulator/touch-input";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { avatarUrl, instantiateAvatar, prepareAvatarLoader } from "./street-avatar";

const MIN_DISTANCE = 2.2;
const MAX_DISTANCE = 14;
const DRAG_SENSITIVITY = 0.006;

const cameraBodyMat = new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.5, metalness: 0.3 });

/** El fotógrafo: avatar respirando, con la cámara en las manos, donde quedó parado. */
function PhotographerAvatar({ figureId, position, yaw }: { figureId: string; position: THREE.Vector3; yaw: number }) {
  const spec = figureById(figureId)!;
  const source = useLoader(FBXLoader, avatarUrl(spec), prepareAvatarLoader) as THREE.Group;
  const clipText = useLoader(THREE.FileLoader, `${ANIMATION_DIR}/${isWoman(figureId) ? "f" : "m"}_idle_breathe_01.json`) as unknown as string;
  const cache = useMemo(() => new Map<string, THREE.Material>(), []);
  const { root, mixer } = useMemo(() => {
    const { root, model } = instantiateAvatar(source, spec, cache, "fotografo");
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(stripRootMotion(decodeClip(JSON.parse(clipText) as CompactClip))).play();
    return { root, mixer };
  }, [source, spec, cache, clipText]);
  useFrame((_, delta) => mixer.update(Math.min(delta, 0.1)));
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <primitive object={root} />
      {/* La cámara a la altura del pecho. */}
      <mesh position={[0, 1.42, 0.3]} material={cameraBodyMat} castShadow>
        <boxGeometry args={[0.14, 0.1, 0.08]} />
      </mesh>
      <mesh position={[0, 1.42, 0.38]} rotation={[Math.PI / 2, 0, 0]} material={cameraBodyMat}>
        <cylinderGeometry args={[0.035, 0.035, 0.09, 16]} />
      </mesh>
    </group>
  );
}

function ThirdPersonRig({ figureId }: { figureId: string }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  // Dónde quedó el fotógrafo al salir de la cámara.
  const saved = useMemo(() => ({ position: camera.position.clone(), quaternion: camera.quaternion.clone() }), [camera]);
  const feet = useMemo(() => {
    const ground = simulatorRuntime.walkableWorld?.groundHeight(saved.position.x, saved.position.z) ?? 0;
    return new THREE.Vector3(saved.position.x, ground, saved.position.z);
  }, [saved]);
  const facing = useMemo(() => new THREE.Euler().setFromQuaternion(saved.quaternion, "YXZ").y + Math.PI, [saved]);
  // Arranca detrás y arriba del fotógrafo, mirando lo mismo que él.
  const orbit = useRef({ yaw: facing + Math.PI, pitch: 0.42, distance: 5 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    simulatorRuntime.thirdPerson = true;
    const el = gl.domElement.parentElement?.parentElement ?? gl.domElement;
    const target = document.querySelector("[data-cod-nav-surface]") ?? el;
    const down = (e: Event) => {
      const p = e as PointerEvent;
      drag.current = { x: p.clientX, y: p.clientY };
    };
    const move = (e: Event) => {
      const p = e as PointerEvent;
      if (!drag.current) return;
      orbit.current.yaw -= (p.clientX - drag.current.x) * DRAG_SENSITIVITY;
      orbit.current.pitch = THREE.MathUtils.clamp(orbit.current.pitch + (p.clientY - drag.current.y) * DRAG_SENSITIVITY, 0.05, 1.35);
      drag.current = { x: p.clientX, y: p.clientY };
    };
    const up = () => {
      drag.current = null;
    };
    const wheel = (e: Event) => {
      const w = e as WheelEvent;
      orbit.current.distance = THREE.MathUtils.clamp(orbit.current.distance * (w.deltaY > 0 ? 1.1 : 0.9), MIN_DISTANCE, MAX_DISTANCE);
    };
    target.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    target.addEventListener("wheel", wheel, { passive: true });
    return () => {
      target.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      target.removeEventListener("wheel", wheel);
      // Vuelve a la cámara del fotógrafo tal como estaba.
      camera.position.copy(saved.position);
      camera.quaternion.copy(saved.quaternion);
      simulatorRuntime.thirdPerson = false;
    };
  }, [camera, gl, saved]);

  useFrame(() => {
    // En el celular se gira arrastrando el dedo (lo que en primera persona sería mirar).
    if (touchInput.lookDX || touchInput.lookDY) {
      orbit.current.yaw -= touchInput.lookDX * DRAG_SENSITIVITY;
      orbit.current.pitch = THREE.MathUtils.clamp(orbit.current.pitch + touchInput.lookDY * DRAG_SENSITIVITY, 0.05, 1.35);
      touchInput.lookDX = 0;
      touchInput.lookDY = 0;
    }
    // Joystick adelante/atrás: acercar y alejar.
    if (Math.abs(touchInput.moveY) > 0.1) {
      orbit.current.distance = THREE.MathUtils.clamp(orbit.current.distance * (1 - touchInput.moveY * 0.02), MIN_DISTANCE, MAX_DISTANCE);
    }
    const { yaw, pitch } = orbit.current;
    const pivot = new THREE.Vector3(feet.x, feet.y + 1.3, feet.z);
    // Si hay una pared en el medio, la cámara se acerca hasta quedar de este lado.
    const dx = Math.sin(yaw) * Math.cos(pitch);
    const dz = Math.cos(yaw) * Math.cos(pitch);
    let distance = orbit.current.distance;
    const world = simulatorRuntime.walkableWorld;
    if (world) {
      for (let d = 0.5; d <= orbit.current.distance; d += 0.25) {
        const x = pivot.x + dx * d;
        const z = pivot.z + dz * d;
        const [rx, rz] = world.resolve(x, z);
        if (Math.hypot(rx - x, rz - z) > 0.01) {
          distance = Math.max(0.6, d - 0.35);
          break;
        }
      }
    }
    camera.position.set(pivot.x + dx * distance, pivot.y + Math.sin(pitch) * distance, pivot.z + dz * distance);
    camera.lookAt(pivot);
  });

  return (
    <Suspense fallback={null}>
      <PhotographerAvatar figureId={figureId} position={feet} yaw={facing} />
    </Suspense>
  );
}

/** Vista de afuera con el avatar del fotógrafo (sólo mientras está activa). */
export default function ThirdPersonView() {
  const state = useSyncExternalStore(thirdPersonStore.subscribe, thirdPersonStore.get, thirdPersonStore.get);
  return state.on ? <ThirdPersonRig key={state.figure} figureId={state.figure} /> : null;
}
