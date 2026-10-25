"use client";

import { shutterSpeedToSeconds } from "@/lib/simulator/camera-math";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { MODIFIERS, flashEnergy, flashIntensityForShutter, flashStore, type OffCameraFlash } from "@/lib/simulator/street/flash";
import { isTouchGameDevice } from "@/lib/simulator/touch-input";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";

/**
 * Unidades de luz de la escena por lux real. Calibrado con el fotómetro: a
 * plena potencia, ISO 100 y f/13, un flash directo a 3 m expone bien (GN 40).
 */
export const SCENE_UNITS_PER_LUX = 0.0124;

/** Durante la toma, el flash dispara sólo en el cuadro que corresponde (lo maneja la captura). */
export const flashFiring = { override: null as boolean | null };

const lights = new Set<() => void>();

/** Aplica ya la intensidad de todos los flashes (la captura dibuja fuera del ciclo de cuadros). */
export function updateFlashLights() {
  for (const apply of lights) apply();
}

function currentShutterSeconds(): number {
  const sh = simulatorRuntime.derived?.effectiveSettings.shutterSpeed;
  return sh ? shutterSpeedToSeconds(sh) : 1 / 125;
}

function firingNow(): boolean {
  return flashFiring.override ?? flashStore.get().preview;
}

function direction(yawDeg: number, pitchDeg: number): THREE.Vector3 {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
}

const standMat = new THREE.MeshStandardMaterial({ color: "#1b1b1d", metalness: 0.6, roughness: 0.4 });
const headMat = new THREE.MeshStandardMaterial({ color: "#2a2a2e", metalness: 0.3, roughness: 0.5 });
const diffuserMat = new THREE.MeshStandardMaterial({ color: "#f4f4f2", emissive: "#ffffff", emissiveIntensity: 0, side: THREE.DoubleSide, roughness: 0.9 });

/** Un flash en su pie: patas, caño, cabezal, modificador y la luz. */
function FlashStand({ flash, shadows }: { flash: OffCameraFlash; shadows: boolean }) {
  const light = useRef<THREE.SpotLight>(null);
  const head = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const spec = MODIFIERS[flash.modifier];
  const [x, y, z] = flash.position;
  const dir = direction(flash.yawDeg, flash.pitchDeg);
  target.position.set(x + dir.x * 3, y + dir.y * 3, z + dir.z * 3);

  const apply = useMemo(
    () => () => {
      const l = light.current;
      if (!l) return;
      const fire = firingNow() && flash.on;
      const energy = flashEnergy(flash.powerStops, spec.lossStops);
      l.intensity = fire ? flashIntensityForShutter(energy, currentShutterSeconds()) * SCENE_UNITS_PER_LUX : 0;
    },
    [flash.on, flash.powerStops, spec.lossStops],
  );
  useEffect(() => {
    lights.add(apply);
    return () => {
      lights.delete(apply);
    };
  }, [apply]);
  useFrame(apply);

  const foot = simulatorRuntime.walkableWorld?.groundHeight(x, z) ?? 0;
  const poleLength = Math.max(0.3, y - foot - 0.1);
  return (
    <group>
      {/* Patas y caño. */}
      {[0, 2.094, 4.189].map((a) => (
        <mesh key={a} position={[x + Math.cos(a) * 0.28, foot + 0.32, z + Math.sin(a) * 0.28]} rotation={[Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75]} material={standMat}>
          <cylinderGeometry args={[0.012, 0.012, 0.8, 6]} />
        </mesh>
      ))}
      <mesh position={[x, foot + 0.1 + poleLength / 2, z]} material={standMat}>
        <cylinderGeometry args={[0.016, 0.02, poleLength, 8]} />
      </mesh>
      {/* Cabezal y modificador, mirando hacia donde apunta. */}
      <group ref={head} position={[x, y, z]} rotation={[-THREE.MathUtils.degToRad(flash.pitchDeg), THREE.MathUtils.degToRad(flash.yawDeg), 0, "YXZ"]}>
        <mesh material={headMat} position={[0, 0, -0.1]}>
          <boxGeometry args={[0.1, 0.12, 0.2]} />
        </mesh>
        {flash.modifier === "softbox" ? (
          <>
            <mesh position={[0, 0, 0.18]} material={standMat}>
              <boxGeometry args={[0.7, 0.7, 0.36]} />
            </mesh>
            <mesh position={[0, 0, 0.365]} material={diffuserMat}>
              <planeGeometry args={[0.66, 0.66]} />
            </mesh>
          </>
        ) : flash.modifier === "stripbox" ? (
          <>
            <mesh position={[0, 0, 0.15]} material={standMat}>
              <boxGeometry args={[0.32, 1.1, 0.3]} />
            </mesh>
            <mesh position={[0, 0, 0.305]} material={diffuserMat}>
              <planeGeometry args={[0.28, 1.06]} />
            </mesh>
          </>
        ) : flash.modifier === "paraguas" ? (
          <mesh position={[0, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]} material={diffuserMat}>
            <coneGeometry args={[0.55, 0.35, 16, 1, true]} />
          </mesh>
        ) : null}
      </group>
      <primitive object={target} />
      <spotLight
        ref={light}
        position={[x, y, z]}
        target={target}
        color="#fff6ec"
        angle={spec.angle}
        penumbra={spec.penumbra}
        decay={2}
        distance={0}
        intensity={0}
        castShadow={shadows}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.0004}
      />
    </group>
  );
}

/** Flash sobre la zapata: sigue a la cámara y cubre lo que entra en el cuadro. */
function OnCameraFlash() {
  const camera = useThree((s) => s.camera);
  const light = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const apply = useMemo(
    () => () => {
      const l = light.current;
      if (!l) return;
      const st = flashStore.get().onCamera;
      const fire = firingNow() && st.on;
      l.intensity = fire ? flashIntensityForShutter(flashEnergy(st.powerStops), currentShutterSeconds()) * SCENE_UNITS_PER_LUX : 0;
      l.position.copy(camera.position).add(new THREE.Vector3(0, 0.12, 0));
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      target.position.copy(l.position).addScaledVector(forward, 5);
      target.updateMatrixWorld();
      // El cabezal se "acerca" con la focal: cubre el cuadro del objetivo.
      const f = simulatorRuntime.focalLengthMm || 50;
      l.angle = Math.min(1.2, Math.atan(21.6 / f) * 1.25);
    },
    [camera, target],
  );
  useEffect(() => {
    lights.add(apply);
    return () => {
      lights.delete(apply);
    };
  }, [apply]);
  useFrame(apply);
  return (
    <>
      <primitive object={target} />
      <spotLight ref={light} target={target} color="#fff6ec" penumbra={0.35} decay={2} distance={0} intensity={0} />
    </>
  );
}

/** Todos los flashes de la calle (en la cámara y en pie). */
export default function StreetFlashes() {
  const state = useSyncExternalStore(flashStore.subscribe, flashStore.get, flashStore.get);
  const shadows = useMemo(() => !isTouchGameDevice(), []);
  return (
    <group name="calle-flashes">
      {state.onCamera.on ? <OnCameraFlash /> : null}
      {state.offCamera.map((f) => (
        <FlashStand key={f.id} flash={f} shadows={shadows} />
      ))}
    </group>
  );
}
