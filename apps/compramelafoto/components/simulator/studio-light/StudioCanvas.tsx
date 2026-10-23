"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { SUBJECT_HEAD, renderExposure, roomN2 } from "@/lib/simulator/studio-light/metering";
import { useStudio } from "@/lib/simulator/studio-light/studio-store";
import StudioBackdrop from "./StudioBackdrop";
import StudioLightRig, { HELPER_LAYER } from "./StudioLightRig";
import StudioFigure from "./StudioFigure";
import StudioSubject from "./StudioSubject";
import { figureById, isBust } from "@/lib/simulator/studio-light/figures";

// Debe correr antes de compilar cualquier material, si no las luces de área no iluminan.
// El módulo sólo se carga en el navegador (dynamic sin SSR).
RectAreaLightUniformsLib.init();

export type StudioViewMode = "set" | "camera";

/** Relación de aspecto del sensor (3:2, full frame). */
export const PHOTO_ASPECT = 3 / 2;
const SENSOR_HEIGHT_MM = 24;

/** Miniatura de la otra vista (px CSS), arriba a la derecha. */
export const PIP_MARGIN = 14;
export function pipWidth(canvasWidth: number): number {
  return Math.min(340, canvasWidth * 0.3);
}

/**
 * Calibración visual: una superficie blanca medida en "0 EV" queda un poco
 * por debajo del blanco puro después del tone mapping.
 */
const RENDER_CALIBRATION = 0.62;

export interface Histogram {
  bins: number[];
  /** Porción de píxeles quemados / empastados. */
  clipHigh: number;
  clipLow: number;
}

export interface StudioCanvasHandle {
  capture: () => Promise<string | null>;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function fitPhoto(r: Rect): Rect {
  let w = r.w;
  let h = w / PHOTO_ASPECT;
  if (h > r.h) {
    h = r.h;
    w = h * PHOTO_ASPECT;
  }
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}

function focalToFov(focalMm: number): number {
  return (2 * Math.atan(SENSOR_HEIGHT_MM / 2 / focalMm) * 180) / Math.PI;
}

/** Grilla de piso de 50 cm, sólo en la vista del set. */
function SetGrid() {
  const ref = useRef<THREE.GridHelper>(null);
  useLayoutEffect(() => {
    ref.current?.layers.set(HELPER_LAYER);
  });
  return <gridHelper ref={ref} args={[14, 28, "#3a3f4a", "#23272f"]} position={[0, 0.004, 1.2]} />;
}

/** Cuerpo de cámara visible en el set (no aparece en la foto). */
function PhotographerCamera({ photoCam }: { photoCam: THREE.PerspectiveCamera }) {
  const { state } = useStudio();
  const group = useRef<THREE.Group>(null);
  const { x, y, z, aimY } = state.camera;
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    g.position.set(x, y, z);
    g.lookAt(SUBJECT_HEAD[0], aimY, SUBJECT_HEAD[2]);
    g.traverse((o) => o.layers.set(HELPER_LAYER));
    photoCam.position.set(x, y, z);
    photoCam.lookAt(SUBJECT_HEAD[0], aimY, SUBJECT_HEAD[2]);
    photoCam.fov = focalToFov(state.camera.focalMm);
    photoCam.aspect = PHOTO_ASPECT;
    photoCam.updateProjectionMatrix();
  });
  return (
    <group ref={group}>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[0.15, 0.11, 0.08]} />
        <meshStandardMaterial color="#1b1b1e" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.038, 0.042, 0.1, 24]} />
        <meshStandardMaterial color="#0c0c0e" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, -y / 2, -0.02]}>
        <cylinderGeometry args={[0.012, 0.012, y, 8]} />
        <meshStandardMaterial color="#2b2d31" />
      </mesh>
    </group>
  );
}

function readLumaHistogram(gl: THREE.WebGLRenderer, r: Rect, dpr: number): Histogram {
  const ctx = gl.getContext();
  const w = Math.max(1, Math.floor(r.w * dpr));
  const h = Math.max(1, Math.floor(r.h * dpr));
  const x = Math.floor(r.x * dpr);
  // r.y está medido desde abajo (convención de WebGL en setViewport).
  const y = Math.floor(r.y * dpr);
  const pixels = new Uint8Array(w * h * 4);
  ctx.readPixels(x, y, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
  const bins = new Array(64).fill(0);
  let high = 0;
  let low = 0;
  let count = 0;
  const step = Math.max(1, Math.floor((w * h) / 40000)) * 4;
  for (let i = 0; i < pixels.length; i += step) {
    const l = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    bins[Math.min(63, Math.floor(l / 4))] += 1;
    if (pixels[i] >= 250 || pixels[i + 1] >= 250 || pixels[i + 2] >= 250) high += 1;
    if (l <= 3) low += 1;
    count += 1;
  }
  const max = Math.max(1, ...bins);
  return { bins: bins.map((b) => b / max), clipHigh: high / count, clipLow: low / count };
}

function cropCanvas(source: HTMLCanvasElement, r: Rect, dpr: number): string | null {
  try {
    const out = document.createElement("canvas");
    out.width = Math.round(r.w * dpr);
    out.height = Math.round(r.h * dpr);
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    // Canvas 2D mide Y desde arriba; WebGL desde abajo.
    const topY = source.height - Math.round((r.y + r.h) * dpr);
    ctx.drawImage(source, Math.round(r.x * dpr), topY, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.92);
  } catch {
    return null;
  }
}

interface RendererProps {
  mode: StudioViewMode;
  photoCam: THREE.PerspectiveCamera;
  workLight: THREE.HemisphereLight;
  workKey: THREE.DirectionalLight;
  roomLight: THREE.HemisphereLight;
  captureRef: MutableRefObject<((dataUrl: string | null) => void) | null>;
  onHistogram: (h: Histogram) => void;
  showPip: boolean;
}

/** Dibuja la vista principal y la miniatura (set ↔ foto) en el mismo lienzo. */
function DualViewRenderer({ mode, photoCam, workLight, workKey, roomLight, captureRef, onHistogram, showPip }: RendererProps) {
  const { state } = useStudio();
  const lastHistogram = useRef(0);
  const exposure = renderExposure(state) * RENDER_CALIBRATION;
  const room = roomN2(state);

  useFrame(({ gl, scene, camera, size }) => {
    const setCam = camera as THREE.PerspectiveCamera;
    setCam.layers.enable(HELPER_LAYER);
    const dpr = gl.getPixelRatio();
    const full: Rect = { x: 0, y: 0, w: size.width, h: size.height };
    const pipW = pipWidth(size.width);
    // setViewport mide Y desde abajo: la miniatura queda arriba a la derecha.
    const pipH = pipW / PHOTO_ASPECT;
    const pip: Rect = { x: size.width - pipW - PIP_MARGIN, y: size.height - pipH - PIP_MARGIN, w: pipW, h: pipH };

    // La luz de la sala (hemisférica) se ve en la foto; la de trabajo sólo en el set.
    roomLight.intensity = room * 0.6 * Math.PI;
    // Luz de trabajo del set: constante a la vista, sin importar la exposición de la foto.
    workLight.intensity = 1.4 / Math.max(1e-6, exposure);
    workKey.intensity = 2.2 / Math.max(1e-6, exposure);

    gl.autoClear = false;
    gl.setScissorTest(false);
    gl.setClearColor("#050508", 1);
    gl.clear();

    const drawSet = (r: Rect) => {
      setCam.aspect = r.w / r.h;
      setCam.updateProjectionMatrix();
      gl.toneMappingExposure = exposure;
      gl.setViewport(r.x, r.y, r.w, r.h);
      gl.setScissor(r.x, r.y, r.w, r.h);
      gl.setScissorTest(true);
      gl.setClearColor("#0b0b10", 1);
      gl.clear();
      gl.render(scene, setCam);
    };

    const drawPhoto = (outer: Rect, readHistogram: boolean): Rect => {
      const r = fitPhoto(outer);
      gl.toneMappingExposure = exposure;
      gl.setViewport(r.x, r.y, r.w, r.h);
      gl.setScissor(r.x, r.y, r.w, r.h);
      gl.setScissorTest(true);
      gl.setClearColor("#000000", 1);
      gl.clear();
      gl.render(scene, photoCam);
      if (readHistogram) {
        const now = performance.now();
        if (now - lastHistogram.current > 900) {
          lastHistogram.current = now;
          onHistogram(readLumaHistogram(gl, r, dpr));
        }
      }
      return r;
    };

    // Captura: la foto ocupa todo el lienzo un instante y se recorta a 3:2.
    const pending = captureRef.current;
    if (pending) {
      captureRef.current = null;
      const r = drawPhoto(full, false);
      pending(cropCanvas(gl.domElement, r, dpr));
      gl.setScissorTest(false);
      gl.clear();
    }

    if (mode === "set") {
      drawSet(full);
      if (showPip) {
        drawPhoto(pip, true);
      }
    } else {
      drawPhoto(full, true);
      if (showPip) drawSet(pip);
    }
    gl.setScissorTest(false);
  }, 1);

  return null;
}

function SceneContent(props: {
  mode: StudioViewMode;
  captureRef: RendererProps["captureRef"];
  onHistogram: RendererProps["onHistogram"];
  showPip: boolean;
}) {
  const { state } = useStudio();
  const figure = figureById(state.subject);
  const photoCam = useMemo(() => new THREE.PerspectiveCamera(30, PHOTO_ASPECT, 0.05, 40), []);
  const workLight = useMemo(() => {
    const l = new THREE.HemisphereLight("#cfd8ff", "#2a2a30", 0);
    l.layers.set(HELPER_LAYER);
    return l;
  }, []);
  // Luz direccional suave sólo para la vista del set: deja ver pies, jirafas y modificadores.
  const workKey = useMemo(() => {
    const l = new THREE.DirectionalLight("#ffffff", 0);
    l.position.set(3, 6, 5);
    l.layers.set(HELPER_LAYER);
    return l;
  }, []);
  const roomLight = useMemo(() => new THREE.HemisphereLight("#fff4e6", "#3a3631", 0), []);
  // Bloqueos de la órbita mientras el mouse está sobre una luz o la arrastra.
  // Van en estado: si se tocaran a mano, cada redibujado los volvería a activar.
  const [orbitLocked, setOrbitLocked] = useState(false);
  const [zoomLocked, setZoomLocked] = useState(false);
  // El control de órbita escucha el lienzo y recibe el clic antes que la luz:
  // además del estado, se lo apaga en el acto para que no llegue a girar.
  const controls = useThree((s) => s.controls) as { enabled: boolean; enableZoom: boolean } | null;

  return (
    <>
      <primitive object={workLight} />
      <primitive object={workKey} />
      <SetGrid />
      <primitive object={roomLight} />
      <StudioBackdrop backdrop={state.backdrop} />
      <Suspense fallback={null}>
        {isBust(state.subject) ? (
          <StudioSubject subject={state.subject} yaw={state.subjectYaw} />
        ) : figure ? (
          <StudioFigure key={figure.id} figure={figure} yaw={state.subjectYaw} pose={state.poseParams} />
        ) : null}
      </Suspense>
      <PhotographerCamera photoCam={photoCam} />
      <StudioLightRig
        showHelpers={props.mode === "set"}
        setZoomEnabled={(on) => {
          if (controls) controls.enableZoom = on;
          setZoomLocked(!on);
        }}
        setOrbitEnabled={(on) => {
          if (controls) controls.enabled = on && props.mode === "set";
          setOrbitLocked(!on);
        }}
      />
      <OrbitControls
        makeDefault
        enabled={props.mode === "set" && !orbitLocked}
        enableZoom={!zoomLocked}
        target={[0, 1.25, 0]}
        minDistance={1.2}
        maxDistance={12}
        maxPolarAngle={Math.PI / 2 - 0.03}
        enableDamping
      />
      <DualViewRenderer
        mode={props.mode}
        photoCam={photoCam}
        workLight={workLight}
        workKey={workKey}
        roomLight={roomLight}
        captureRef={props.captureRef}
        onHistogram={props.onHistogram}
        showPip={props.showPip}
      />
    </>
  );
}

export interface StudioCanvasProps {
  mode: StudioViewMode;
  captureRef: RendererProps["captureRef"];
  onHistogram: (h: Histogram) => void;
  showPip: boolean;
}

export default function StudioCanvas({ mode, captureRef, onHistogram, showPip }: StudioCanvasProps) {
  return (
    <Canvas
      className="cod-studio__canvas"
      // PCF respeta shadow.radius (borde regulable) sin las rayas que deja VSM en el fondo.
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{ position: [4.2, 3.1, 5.2], fov: 42, near: 0.05, far: 60 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <SceneContent mode={mode} captureRef={captureRef} onHistogram={onHistogram} showPip={showPip} />
    </Canvas>
  );
}
