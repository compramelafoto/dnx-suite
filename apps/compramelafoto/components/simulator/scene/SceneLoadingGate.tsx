"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { loadingGate } from "@/lib/simulator/loading-gate";

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
      gl.compile(scene, camera);
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
