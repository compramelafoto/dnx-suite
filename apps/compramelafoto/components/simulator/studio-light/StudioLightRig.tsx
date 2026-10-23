"use client";

import { Html, Line } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MODIFIERS, powerLabel } from "@/lib/simulator/studio-light/modifiers";
import {
  activeLights,
  aimPoint,
  lightOutput,
  renderExposure,
  renderedLightColor,
} from "@/lib/simulator/studio-light/metering";
import { MAX_POWER_STOPS } from "@/lib/simulator/studio-light/presets";
import { useStudio } from "@/lib/simulator/studio-light/studio-store";
import type { StudioLight } from "@/lib/simulator/studio-light/types";

/** Capa de ayudas visibles sólo en la vista del set (no en la foto). */
export const HELPER_LAYER = 1;

const FABRIC = "#121214";
const METAL = "#2b2d31";

function useHelperLayer<T extends THREE.Object3D>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => o.layers.set(HELPER_LAYER));
  });
  return ref;
}

/** Forma visible del modificador; el frente mira a +Z (hacia donde apunta la luz). */
function ModifierBody({ light, glow }: { light: StudioLight; glow: number }) {
  const spec = MODIFIERS[light.modifier];
  const emissive = (
    <meshStandardMaterial color="#ffffff" emissive="#fff6e8" emissiveIntensity={glow} roughness={1} toneMapped />
  );
  const fabric = <meshStandardMaterial color={FABRIC} roughness={0.95} />;
  const w = spec.width;
  const h = spec.height;

  if (spec.nature === "reflector") {
    const metallic = light.modifier !== "reflector-white";
    return (
      <mesh castShadow>
        <circleGeometry args={[w / 2, 40]} />
        <meshStandardMaterial
          color={spec.tint}
          roughness={metallic ? 0.35 : 0.9}
          metalness={metallic ? 0.85 : 0}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  switch (spec.shape) {
    case "rect": {
      const depth = Math.max(0.22, Math.min(w, h) * 0.6);
      return (
        <group>
          <mesh position={[0, 0, -depth / 2]} castShadow>
            <boxGeometry args={[w, h, depth]} />
            {fabric}
          </mesh>
          <mesh position={[0, 0, 0.004]}>
            <planeGeometry args={[w * 0.96, h * 0.96]} />
            {emissive}
          </mesh>
        </group>
      );
    }
    case "panel":
      return (
        <group>
          <mesh position={[0, 0, -0.025]} castShadow>
            <boxGeometry args={[w, h, 0.05]} />
            <meshStandardMaterial color={METAL} roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.002]}>
            <planeGeometry args={[w * 0.94, h * 0.9]} />
            {emissive}
          </mesh>
        </group>
      );
    case "ring":
      return (
        <mesh castShadow>
          <torusGeometry args={[w / 2 - 0.04, 0.04, 16, 48]} />
          {emissive}
        </mesh>
      );
    default: {
      const isSnoot = light.modifier === "snoot";
      const isFresnel = light.modifier === "fresnel";
      const depth = isSnoot ? 0.28 : light.modifier === "umbrella-white" ? 0.45 : Math.max(0.14, w * 0.42);
      const rTop = isSnoot ? 0.035 : 0.075;
      return (
        <group>
          <mesh position={[0, 0, -depth / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[w / 2, rTop, depth, w > 0.5 ? 8 : 24, 1, true]} />
            <meshStandardMaterial
              color={isFresnel || light.modifier === "bare" || light.modifier === "grid" ? METAL : FABRIC}
              metalness={0.4}
              roughness={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, -0.01]}>
            <circleGeometry args={[w / 2 - 0.004, w > 0.5 ? 8 : 32]} />
            {emissive}
          </mesh>
        </group>
      );
    }
  }
}

/** Desplazamiento lateral del pie cuando la luz va con jirafa (m). */
const BOOM_REACH = 0.95;

/**
 * Luz delante del sujeto y cerca del eje de cámara (mariposa, clamshell): en un
 * estudio real va colgada de una jirafa para que el pie no tape la cara.
 */
export function usesBoom(light: StudioLight): boolean {
  if (light.z < 0.25 || light.y < 1.3) return false;
  return Math.abs(Math.atan2(light.x, light.z)) < (28 * Math.PI) / 180;
}

function StandLegs() {
  return (
    <>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.sin(a) * 0.22, 0.12, Math.cos(a) * 0.22]}
            rotation={[Math.cos(a) * 1.05, 0, -Math.sin(a) * 1.05]}
            castShadow
          >
            <cylinderGeometry args={[0.01, 0.01, 0.5, 6]} />
            <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
          </mesh>
        );
      })}
    </>
  );
}

function LightStand({ light }: { light: StudioLight }) {
  const metal = <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />;
  if (usesBoom(light)) {
    const side = light.x >= 0 ? 1 : -1;
    const top = light.y + 0.18;
    return (
      <group position={[light.x, 0, light.z]}>
        <group position={[side * BOOM_REACH, 0, 0.15]}>
          <mesh position={[0, top / 2, 0]} castShadow>
            <cylinderGeometry args={[0.016, 0.02, top, 8]} />
            {metal}
          </mesh>
          <StandLegs />
        </group>
        {/* Brazo horizontal y bajada corta hasta el cabezal. */}
        <mesh position={[(side * BOOM_REACH) / 2, top, 0.075]} rotation={[0, Math.atan2(-0.15, side * BOOM_REACH), Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, Math.hypot(BOOM_REACH, 0.15) + 0.3, 8]} />
          {metal}
        </mesh>
        <mesh position={[0, light.y + 0.09, 0]} castShadow>
          <cylinderGeometry args={[0.01, 0.01, 0.18, 6]} />
          {metal}
        </mesh>
      </group>
    );
  }
  const poleTop = Math.max(0.3, light.y - 0.05);
  return (
    <group position={[light.x, 0, light.z]}>
      <mesh position={[0, poleTop / 2, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.018, poleTop, 8]} />
        {metal}
      </mesh>
      <StandLegs />
    </group>
  );
}

interface RigLightProps {
  light: StudioLight;
  showHelpers: boolean;
  setZoomEnabled: (enabled: boolean) => void;
  setOrbitEnabled: (enabled: boolean) => void;
}

function RigLight({ light, showHelpers, setZoomEnabled, setOrbitEnabled }: RigLightProps) {
  const { state, dispatch, checkpoint } = useStudio();
  const camera = useThree((s) => s.camera);
  const spec = MODIFIERS[light.modifier];
  const selected = state.selectedId === light.id;
  const active = activeLights(state).some((l) => l.id === light.id);

  const head = useRef<THREE.Group>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const rect = useRef<THREE.RectAreaLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const helpers = useHelperLayer<THREE.Group>();
  const drag = useRef<{ mode: "floor" | "height"; plane: THREE.Plane; offset: THREE.Vector3 } | null>(null);

  const aim = aimPoint(light);
  const output = active ? lightOutput(light, state) : 0;
  const color = useMemo(() => {
    const [r, g, b] = renderedLightColor(light, state.camera.whiteBalance);
    return new THREE.Color(r, g, b);
  }, [light, state.camera.whiteBalance]);

  const dist = Math.hypot(light.x - aim[0], light.y - aim[1], light.z - aim[2]);
  const sourceSize = Math.sqrt(spec.width * spec.height);
  const shadowRadius = THREE.MathUtils.clamp((sourceSize / Math.max(0.3, dist)) * 14, 1, 9);
  const area = spec.width * spec.height * (spec.shape === "round" ? Math.PI / 4 : 1);
  const glow = active ? Math.min(60, 3.5 / Math.max(1e-4, renderExposure(state))) : 0;

  useLayoutEffect(() => {
    head.current?.lookAt(aim[0], aim[1], aim[2]);
    rect.current?.lookAt(aim[0], aim[1], aim[2]);
    target.position.set(aim[0], aim[1], aim[2]);
    target.updateMatrixWorld();
  });

  function onPointerDown(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    dispatch({ type: "select", id: light.id });
    checkpoint();
    const byHeight = e.shiftKey || e.altKey;
    const pos = new THREE.Vector3(light.x, light.y, light.z);
    let plane: THREE.Plane;
    if (byHeight) {
      const normal = new THREE.Vector3().subVectors(camera.position, pos).setY(0).normalize();
      plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, pos);
    } else {
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -light.y);
    }
    const hit = new THREE.Vector3();
    e.ray.intersectPlane(plane, hit);
    drag.current = { mode: byHeight ? "height" : "floor", plane, offset: pos.clone().sub(hit) };
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    setOrbitEnabled(false);
  }

  function onPointerMove(e: ThreeEvent<PointerEvent>) {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(d.plane, hit)) return;
    hit.add(d.offset);
    if (d.mode === "floor") {
      dispatch({ type: "move-light", id: light.id, x: hit.x, z: hit.z });
    } else {
      dispatch({
        type: "update-light",
        id: light.id,
        patch: { y: THREE.MathUtils.clamp(hit.y, 0.25, 3.6) },
      });
    }
  }

  function endDrag(e: ThreeEvent<PointerEvent>) {
    if (!drag.current) return;
    drag.current = null;
    (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
    setOrbitEnabled(true);
  }

  function onWheel(e: ThreeEvent<WheelEvent>) {
    if (spec.nature === "reflector") return;
    e.stopPropagation();
    const step = e.deltaY > 0 ? 1 / 3 : -1 / 3;
    const next = THREE.MathUtils.clamp(Math.round((light.powerStops + step) * 3) / 3, 0, MAX_POWER_STOPS);
    dispatch({ type: "update-light", id: light.id, patch: { powerStops: next } });
  }

  const interactive = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onWheel,
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setZoomEnabled(false);
      document.body.style.cursor = "grab";
    },
    onPointerOut: () => {
      setZoomEnabled(true);
      document.body.style.cursor = "";
    },
  };

  const spotShare = 1 - spec.areaShare;
  const halfAngle = Math.min(Math.PI / 2 - 0.02, ((spec.beamDeg / 2) * Math.PI) / 180);
  const statusLabel = !light.on
    ? "apagada"
    : spec.nature === "reflector"
      ? "rebote"
      : powerLabel(light.powerStops);

  return (
    <group>
      <primitive object={target} />
      {/* Sólo se arrastra desde la vista del set: los eventos usan esa cámara. */}
      <group {...(showHelpers ? interactive : {})}>
        <LightStand light={light} />
        <group ref={head} position={[light.x, light.y, light.z]}>
          <ModifierBody light={light} glow={glow} />
          {spec.nature !== "reflector" ? (
            <mesh position={[0, 0, -0.32]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.075, 0.075, 0.26, 20]} />
              <meshStandardMaterial color="#d9d9dc" roughness={0.45} metalness={0.2} />
            </mesh>
          ) : null}
        </group>
      </group>

      {output > 0 && spotShare > 0 ? (
        <spotLight
          ref={spot}
          position={[light.x, light.y, light.z]}
          target={target}
          color={color}
          intensity={output * spotShare}
          angle={halfAngle}
          penumbra={spec.penumbra}
          decay={2}
          distance={0}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0003}
          shadow-normalBias={0.006}
          shadow-radius={shadowRadius}
          shadow-camera-near={0.1}
          shadow-camera-far={14}
        />
      ) : null}
      {output > 0 && spec.areaShare > 0 ? (
        <rectAreaLight
          ref={rect}
          position={[light.x, light.y, light.z]}
          width={spec.shape === "round" ? spec.width * 0.886 : spec.width}
          height={spec.shape === "round" ? spec.height * 0.886 : spec.height}
          color={color}
          intensity={(output * spec.areaShare) / area}
        />
      ) : null}

      {showHelpers ? (
        <group ref={helpers}>
          <Line
            points={[
              [light.x, light.y, light.z],
              [aim[0], aim[1], aim[2]],
            ]}
            color={selected ? "#ffd400" : "#6ec8ff"}
            lineWidth={selected ? 1.6 : 0.8}
            dashed
            dashSize={0.06}
            gapSize={0.05}
            transparent
            opacity={light.on ? 0.85 : 0.25}
          />
          {selected ? (
            <mesh position={[light.x, 0.01, light.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.3, 0.36, 48]} />
              <meshBasicMaterial color="#ffd400" toneMapped={false} />
            </mesh>
          ) : null}
          <Html
            position={[light.x, light.y + Math.max(spec.height, 0.2) / 2 + 0.22, light.z]}
            center
            zIndexRange={[20, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              className={`cod-studio-tag${selected ? " cod-studio-tag--selected" : ""}${light.on ? "" : " cod-studio-tag--off"}`}
            >
              <span className="cod-studio-tag__name">{light.name}</span>
              <span className="cod-studio-tag__meta">
                {statusLabel} · {dist.toFixed(1).replace(".", ",")} m
              </span>
            </div>
          </Html>
        </group>
      ) : null}
    </group>
  );
}

export interface StudioLightRigProps {
  showHelpers: boolean;
  setZoomEnabled: (enabled: boolean) => void;
  setOrbitEnabled: (enabled: boolean) => void;
}

export default function StudioLightRig(props: StudioLightRigProps) {
  const { state } = useStudio();
  return (
    <>
      {state.lights.map((light) => (
        <RigLight key={light.id} light={light} {...props} />
      ))}
    </>
  );
}
