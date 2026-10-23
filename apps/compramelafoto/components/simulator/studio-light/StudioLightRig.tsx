"use client";

import { Html, Line } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MODIFIERS, powerLabel } from "@/lib/simulator/studio-light/modifiers";
import {
  activeLights,
  aimPoint,
  subjectHead,
  lightOutput,
  renderExposure,
  renderedLightColor,
} from "@/lib/simulator/studio-light/metering";
import { boomOffset } from "@/lib/simulator/studio-light/boom";
import { startPlaneDrag, verticalPlaneFacing } from "./plane-drag";
import { MAX_POWER_STOPS } from "@/lib/simulator/studio-light/presets";
import { useStudio } from "@/lib/simulator/studio-light/studio-store";
import type { StudioLight } from "@/lib/simulator/studio-light/types";

/** Capa de ayudas visibles sólo en la vista del set (no en la foto). */
export const HELPER_LAYER = 1;

const FABRIC = "#121214";
// Aluminio de pies y jirafas: claro para que se lean en la vista del set.
const METAL = "#8d939c";

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
  const boom = boomOffset(light);
  if (boom) {
    const top = light.y + 0.18;
    const reach = Math.hypot(boom.x, boom.z);
    return (
      <group position={[light.x, 0, light.z]}>
        <group position={[boom.x, 0, boom.z]}>
          <mesh position={[0, top / 2, 0]} castShadow>
            <cylinderGeometry args={[0.016, 0.02, top, 8]} />
            {metal}
          </mesh>
          <StandLegs />
        </group>
        {/* Brazo de la jirafa (con contrapeso del otro lado) y bajada corta hasta el cabezal. */}
        <mesh position={[boom.x / 2, top, boom.z / 2]} rotation={[0, Math.atan2(boom.z, -boom.x), Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, reach + 0.55, 8]} />
          {metal}
        </mesh>
        <mesh position={[boom.x * (1 + 0.5 / reach), top, boom.z * (1 + 0.5 / reach)]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.12, 12]} />
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
  const dragging = useRef(false);
  const gl = useThree((s) => s.gl);

  const rawAim = aimPoint(light, subjectHead(state));
  // Si la luz apunta casi en vertical, lookAt (y la cámara de sombra) quedan indefinidos:
  // se corre el blanco unos centímetros hacia la cámara.
  const aim: typeof rawAim =
    Math.hypot(light.x - rawAim[0], light.z - rawAim[2]) < 0.05 ? [rawAim[0], rawAim[1], rawAim[2] + 0.05] : rawAim;
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

  /**
   * Arrastre de la luz. "free": desde el cuerpo, a la altura del punto tomado
   * (Shift cambia la altura). "floor": desde el aro del piso. "height": desde la
   * manija de altura. Siempre por diferencia desde el punto inicial.
   */
  function beginDrag(e: ThreeEvent<PointerEvent>, kind: "free" | "floor" | "height") {
    if (e.button !== 0) return;
    e.stopPropagation();
    dispatch({ type: "select", id: light.id });
    checkpoint();
    setOrbitEnabled(false);

    const byHeight = kind === "height" || (kind === "free" && (e.shiftKey || e.altKey));
    const start = new THREE.Vector3(light.x, light.y, light.z);
    // Altura del punto exacto tomado: ese punto queda pegado al cursor.
    const grabY = kind === "floor" ? 0 : e.point.y;
    const plane = byHeight
      ? verticalPlaneFacing(camera, new THREE.Vector3(light.x, grabY, light.z))
      : // Plano horizontal a la altura tomada; si la cámara está casi a esa
        // altura el plano se vuelve inestable y se usa el piso.
        new THREE.Plane(new THREE.Vector3(0, 1, 0), Math.abs(camera.position.y - grabY) > 0.5 ? -grabY : 0);
    const ok = startPlaneDrag({
      start: e.nativeEvent,
      plane,
      camera,
      canvas: gl.domElement,
      onMove: (delta) => {
        if (byHeight) {
          dispatch({ type: "update-light", id: light.id, patch: { y: THREE.MathUtils.clamp(start.y + delta.y, 0.25, 3.6) } });
        } else {
          dispatch({ type: "move-light", id: light.id, x: start.x + delta.x, z: start.z + delta.z });
        }
      },
      onEnd: () => {
        dragging.current = false;
        setOrbitEnabled(true);
        setZoomEnabled(true);
      },
    });
    if (ok) dragging.current = true;
    else setOrbitEnabled(true);
  }

  function onPointerDown(e: ThreeEvent<PointerEvent>) {
    beginDrag(e, "free");
  }

  function onWheel(e: ThreeEvent<WheelEvent>) {
    if (spec.nature === "reflector") return;
    e.stopPropagation();
    const step = e.deltaY > 0 ? 1 / 3 : -1 / 3;
    const next = THREE.MathUtils.clamp(Math.round((light.powerStops + step) * 3) / 3, 0, MAX_POWER_STOPS);
    dispatch({ type: "update-light", id: light.id, patch: { powerStops: next } });
  }

  const hoverHandle = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setOrbitEnabled(false);
    if (!dragging.current) document.body.style.cursor = "grab";
  };
  const leaveHandle = () => {
    if (dragging.current) return;
    setOrbitEnabled(true);
    document.body.style.cursor = "";
  };

  const interactive = {
    onPointerDown,
    onWheel,
    // Al pasar sobre una luz se bloquea la órbita: así el clic no empieza a girar la cámara.
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setOrbitEnabled(false);
      setZoomEnabled(false);
      if (!dragging.current) document.body.style.cursor = "grab";
    },
    onPointerOut: () => {
      if (dragging.current) return;
      setOrbitEnabled(true);
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
      <group userData={{ studioLightId: light.id }} {...(showHelpers ? interactive : {})}>
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
            color={selected ? "#ffb547" : "#6ec8ff"}
            lineWidth={selected ? 1.6 : 0.8}
            dashed
            dashSize={0.06}
            gapSize={0.05}
            transparent
            opacity={light.on ? 0.85 : 0.25}
          />
          {selected ? (
            <>
              {/* Manija de piso: arrastrarla mueve la luz sin cambiar su altura. */}
              <mesh
                position={[light.x, 0.012, light.z]}
                rotation={[-Math.PI / 2, 0, 0]}
                onPointerDown={(e) => beginDrag(e, "floor")}
                onPointerOver={hoverHandle}
                onPointerOut={leaveHandle}
              >
                <ringGeometry args={[0.26, 0.4, 48]} />
                <meshBasicMaterial color="#ffb547" toneMapped={false} transparent opacity={0.9} />
              </mesh>
              {/* Manija de altura: esfera con flechas arriba y abajo. */}
              <group
                position={[light.x, light.y + Math.max(spec.height, 0.2) / 2 + 0.5, light.z]}
                onPointerDown={(e) => beginDrag(e, "height")}
                onPointerOver={hoverHandle}
                onPointerOut={leaveHandle}
              >
                <mesh>
                  <sphereGeometry args={[0.07, 20, 14]} />
                  <meshBasicMaterial color="#ffb547" toneMapped={false} />
                </mesh>
                <mesh position={[0, 0.13, 0]}>
                  <coneGeometry args={[0.045, 0.09, 16]} />
                  <meshBasicMaterial color="#ffb547" toneMapped={false} />
                </mesh>
                <mesh position={[0, -0.13, 0]} rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[0.045, 0.09, 16]} />
                  <meshBasicMaterial color="#ffb547" toneMapped={false} />
                </mesh>
              </group>
            </>
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
