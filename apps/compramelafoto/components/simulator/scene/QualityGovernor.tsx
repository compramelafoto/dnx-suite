"use client";

import { QUALITY_TIERS, createGovernor, governorTick } from "@/lib/simulator/render-quality";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

/**
 * Mide la fluidez real y ajusta la calidad (resolución, sombras, SSAO,
 * desenfoque y faroles encendidos) para quedar fluido en cada computadora.
 */
export default function QualityGovernor() {
  const setDpr = useThree((s) => s.setDpr);
  const state = useRef(createGovernor(1));

  useEffect(() => {
    const tier = QUALITY_TIERS[state.current.tier];
    simulatorRuntime.quality = tier;
    setDpr(Math.min(tier.dpr, window.devicePixelRatio || 1));
  }, [setDpr]);

  useFrame((_, delta) => {
    // Durante la toma no se cambia nada: la foto sale con la calidad del momento.
    if (simulatorRuntime.captureActive) return;
    // Sólo en desarrollo: fijar la calidad para comparar capturas (Playwright limita los cuadros).
    if (process.env.NODE_ENV === "development" && (globalThis as Record<string, unknown>).__codQualityLock) return;
    const next = governorTick(state.current, delta);
    if (next === null) return;
    const tier = QUALITY_TIERS[next];
    simulatorRuntime.quality = tier;
    setDpr(Math.min(tier.dpr, window.devicePixelRatio || 1));
    if (process.env.NODE_ENV === "development") console.info("[Cam Of Duty] Calidad", tier.id);
  });

  return null;
}
