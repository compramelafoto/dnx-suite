"use client";

// Primero: en el celular achica las texturas antes de que empiecen a bajar los modelos.
import "@/lib/simulator/mobile-textures-install";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { renderExposure, roomN2, subjectHead } from "@/lib/simulator/studio-light/metering";
import { SET_BOUNDS, useStudio } from "@/lib/simulator/studio-light/studio-store";
import { startPlaneDrag } from "./plane-drag";
import StudioBackdrop from "./StudioBackdrop";
import StudioLightRig, { HELPER_LAYER } from "./StudioLightRig";
import StudioFigure from "./StudioFigure";
import StudioSubject from "./StudioSubject";
import { LoadingHold, SceneLoadingGate } from "../scene/SceneLoadingGate";
import { StudioCameraDirector, StudioWalkController, type QuickView } from "./StudioWalk";
import { figureById, isBust } from "@/lib/simulator/studio-light/figures";

// Debe correr antes de compilar cualquier material, si no las luces de área no iluminan.
// El módulo sólo se carga en el navegador (dynamic sin SSR).
RectAreaLightUniformsLib.init();

/** Set: vista orbital del estudio. Cámara: la foto. Caminar: primera persona. */
export type StudioViewMode = "set" | "camera" | "walk";

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
/** Aro alrededor de los pies del sujeto: arrastrarlo lo gira. Sólo en la vista del set. */
function SubjectRing({ lockOrbit }: { lockOrbit: (locked: boolean) => void }) {
  const { state, dispatch, checkpoint } = useStudio();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const ref = useRef<THREE.Group>(null);
  const dragging = useRef(false);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => o.layers.set(HELPER_LAYER));
  });
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    checkpoint();
    lockOrbit(true);
    const startYaw = state.subjectYaw;
    const ok = startPlaneDrag({
      start: e.nativeEvent,
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      camera,
      canvas: gl.domElement,
      onMove: (delta, hit) => {
        // Punto del clic = punto actual menos el desplazamiento: así un arrastre
        // rápido (un solo movimiento) también gira.
        const startAngle = (Math.atan2(hit.x - delta.x, hit.z - delta.z) * 180) / Math.PI;
        const angle = (Math.atan2(hit.x, hit.z) * 180) / Math.PI;
        let d = angle - startAngle;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        dispatch({ type: "scene-move", patch: { subjectYaw: Math.round(THREE.MathUtils.clamp(startYaw + d, -90, 90)) } });
      },
      onEnd: () => {
        dragging.current = false;
        lockOrbit(false);
      },
    });
    if (ok) dragging.current = true;
    else lockOrbit(false);
  };
  return (
    <group
      ref={ref}
      onPointerDown={onDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        lockOrbit(true);
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        if (dragging.current) return;
        lockOrbit(false);
        document.body.style.cursor = "";
      }}
    >
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.6, 64]} />
        <meshBasicMaterial color="#6ec8ff" toneMapped={false} transparent opacity={0.55} />
      </mesh>
      {/* Marca que indica hacia dónde mira el sujeto. */}
      <mesh
        position={[Math.sin((state.subjectYaw * Math.PI) / 180) * 0.68, 0.014, Math.cos((state.subjectYaw * Math.PI) / 180) * 0.68]}
        rotation={[-Math.PI / 2, 0, -(state.subjectYaw * Math.PI) / 180]}
      >
        <circleGeometry args={[0.07, 3]} />
        <meshBasicMaterial color="#6ec8ff" toneMapped={false} />
      </mesh>
    </group>
  );
}

function PhotographerCamera({
  photoCam,
  walking,
  editable,
  lockOrbit,
}: {
  photoCam: THREE.PerspectiveCamera;
  walking: boolean;
  /** En la vista del set el cuerpo de la cámara se puede arrastrar. */
  editable: boolean;
  lockOrbit: (locked: boolean) => void;
}) {
  const { state, dispatch, checkpoint } = useStudio();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const dragging = useRef(false);
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    checkpoint();
    lockOrbit(true);
    const sx = state.camera.x;
    const sz = state.camera.z;
    const ok = startPlaneDrag({
      start: e.nativeEvent,
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -e.point.y),
      camera,
      canvas: gl.domElement,
      onMove: (d) => {
        // No puede quedar detrás del sujeto ni pegada a él.
        const x = THREE.MathUtils.clamp(sx + d.x, SET_BOUNDS.minX, SET_BOUNDS.maxX);
        const z = THREE.MathUtils.clamp(sz + d.z, 0.6, SET_BOUNDS.maxZ);
        dispatch({ type: "camera-move", patch: { x, z, look: null } });
      },
      onEnd: () => {
        dragging.current = false;
        lockOrbit(false);
      },
    });
    if (ok) dragging.current = true;
    else lockOrbit(false);
  };
  const group = useRef<THREE.Group>(null);
  const { x, y, z, aimY, look } = state.camera;
  const head = subjectHead(state);
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    g.position.set(x, y, z);
    // Con mirada libre (después de caminar) la cámara queda como la dejó el fotógrafo.
    // El cuerpo mira hacia +Z y la cámara hacia −Z: media vuelta y cabeceo invertido.
    if (look) g.rotation.set(-look.pitch, look.yaw + Math.PI, 0, "YXZ");
    else g.lookAt(head[0], aimY, head[2]);
    g.traverse((o) => o.layers.set(HELPER_LAYER));
    photoCam.fov = focalToFov(state.camera.focalMm);
    photoCam.updateProjectionMatrix();
    // Mientras se camina, la posición la maneja el controlador en cada cuadro.
    if (walking) return;
    photoCam.position.set(x, y, z);
    if (look) photoCam.rotation.set(look.pitch, look.yaw, 0, "YXZ");
    else photoCam.lookAt(head[0], aimY, head[2]);
  });
  return (
    <group
      ref={group}
      onPointerDown={onDown}
      onPointerOver={(e) => {
        if (!editable) return;
        e.stopPropagation();
        lockOrbit(true);
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        if (!editable || dragging.current) return;
        lockOrbit(false);
        document.body.style.cursor = "";
      }}
    >
      {/* Volumen invisible más grande: es más fácil de agarrar que el cuerpo chico. */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.4, 0.7, 0.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
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
      photoCam.aspect = PHOTO_ASPECT;
      photoCam.updateProjectionMatrix();
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
    } else if (mode === "walk") {
      // Primera persona a pantalla completa; la foto es el recorte 3:2 del centro
      // (misma altura de campo), que es lo que marcan las guías del visor.
      photoCam.aspect = full.w / full.h;
      photoCam.updateProjectionMatrix();
      gl.toneMappingExposure = exposure;
      gl.setViewport(full.x, full.y, full.w, full.h);
      gl.setScissor(full.x, full.y, full.w, full.h);
      gl.setScissorTest(true);
      gl.render(scene, photoCam);
      const now = performance.now();
      if (now - lastHistogram.current > 900) {
        lastHistogram.current = now;
        onHistogram(readLumaHistogram(gl, fitPhoto(full), dpr));
      }
      if (showPip) drawSet(pip);
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
  onShoot: () => void;
  viewRef: MutableRefObject<((v: QuickView) => void) | null>;
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
      <Suspense fallback={<LoadingHold />}>
        {isBust(state.subject) ? (
          <StudioSubject subject={state.subject} yaw={state.subjectYaw} />
        ) : figure ? (
          <StudioFigure key={figure.id} figure={figure} yaw={state.subjectYaw} pose={state.poseParams} motion={state.motion} />
        ) : null}
      </Suspense>
      <PhotographerCamera
        photoCam={photoCam}
        walking={props.mode === "walk"}
        editable={props.mode === "set"}
        lockOrbit={(locked) => {
          if (controls) controls.enabled = !locked && props.mode === "set";
          setOrbitLocked(locked);
        }}
      />
      {props.mode === "set" ? (
        <SubjectRing
          lockOrbit={(locked) => {
            if (controls) controls.enabled = !locked;
            setOrbitLocked(locked);
          }}
        />
      ) : null}
      <StudioWalkController active={props.mode === "walk"} photoCam={photoCam} onShoot={props.onShoot} />
      <StudioCameraDirector requestRef={props.viewRef} />
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
  /** Disparo desde la primera persona (clic con el mouse capturado). */
  onShoot: () => void;
  /** Vistas rápidas del set: lo llena el lienzo, lo usan los botones. */
  viewRef: MutableRefObject<((v: QuickView) => void) | null>;
}

export default function StudioCanvas({ mode, captureRef, onHistogram, showPip, onShoot, viewRef }: StudioCanvasProps) {
  return (
    <Canvas
      className="cod-studio__canvas"
      // PCF respeta shadow.radius (borde regulable) sin las rayas que deja VSM en el fondo.
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{ position: [4.2, 3.1, 5.2], fov: 42, near: 0.05, far: 60 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      onCreated={({ gl, raycaster }) => {
        // Las manijas viven en la capa de ayudas: el mouse también tiene que tocarlas.
        raycaster.layers.enableAll();
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <SceneContent mode={mode} captureRef={captureRef} onHistogram={onHistogram} showPip={showPip} onShoot={onShoot} viewRef={viewRef} />
      <SceneLoadingGate />
    </Canvas>
  );
}
