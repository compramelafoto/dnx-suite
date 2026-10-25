"use client";

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { loadingGate } from "@/lib/simulator/loading-gate";

/**
 * Dibuja una vez, fuera de pantalla, TODO lo que la escena tiene aunque hoy no
 * se vea (detalles de edificios, objetos y gente que aparecen al acercarse):
 * así la placa de video prepara cada material y sube cada textura y modelo
 * durante la carga, y no al caminar (eso eran los tirones y lo que "aparecía").
 * Las luces no se tocan: cambiar cuántas hay obligaría a rehacer los materiales.
 * Las mallas marcadas `userData.neverDrawn` (p. ej. niveles de detalle sin uso) se saltean.
 */
export function warmUpEverything(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const shown: THREE.Object3D[] = [];
  const culled: THREE.Object3D[] = [];
  const visit = (o: THREE.Object3D) => {
    if ((o as THREE.Light).isLight || o.userData.neverDrawn) return;
    if (!o.visible) {
      o.visible = true;
      shown.push(o);
    }
    if (o.frustumCulled) {
      o.frustumCulled = false;
      culled.push(o);
    }
    for (const c of o.children) visit(c);
  };
  visit(scene);
  const target = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType });
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  gl.render(scene, camera);
  gl.setRenderTarget(previous);
  target.dispose();
  for (const o of shown) o.visible = false;
  for (const o of culled) o.frustumCulled = true;
}

/** Fallback de Suspense: mientras está montado, la escena no está lista. */
export function LoadingHold() {
  useEffect(() => loadingGate.hold(), []);
  return null;
}

/** Cuadros sin archivos pendientes antes de dar la bajada por terminada. */
const QUIET_FRAMES = 20;
/** Cuadros dibujados después de compilar, para que se armen sombras e impostores. */
const SETTLE_FRAMES = 30;
/** Nunca se espera menos que esto: las primeras partes tardan unos cuadros en pedir sus archivos. */
const MIN_FRAMES = 30;

/**
 * Va adentro del Canvas: cuando terminó la bajada, compila los materiales de
 * toda la escena (lo que si no se hace al primer giro de cámara traba la
 * animación), dibuja unos cuadros más y abre la puerta.
 */
export function SceneLoadingGate() {
  const { gl, scene, camera } = useThree();
  const frames = useRef(0);
  const quiet = useRef(0);
  const settled = useRef(-1);

  useEffect(() => {
    loadingGate.restart();
    return () => loadingGate.restart();
  }, []);

  useFrame(() => {
    const s = loadingGate.getSnapshot();
    if (s.ready) return;
    frames.current += 1;
    if (settled.current < 0) {
      quiet.current = loadingGate.idle() ? quiet.current + 1 : 0;
      loadingGate.setWarmup((0.1 * Math.min(quiet.current, QUIET_FRAMES)) / QUIET_FRAMES);
      if (quiet.current < QUIET_FRAMES || frames.current < MIN_FRAMES) return;
      warmUpEverything(gl, scene, camera);
      settled.current = 0;
      return;
    }
    // Si algo nuevo empezó a bajar mientras se acomodaba, se vuelve a esperar.
    if (!loadingGate.idle()) {
      settled.current = -1;
      quiet.current = 0;
      return;
    }
    settled.current += 1;
    loadingGate.setWarmup(0.1 + (0.9 * settled.current) / SETTLE_FRAMES);
    if (settled.current >= SETTLE_FRAMES) loadingGate.markReady();
  });

  return null;
}
