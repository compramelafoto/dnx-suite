"use client";

import {
  getHdriSlotLabel,
  hdriFileExists,
  loadHdriEnvironment,
  logHdriDev,
  resolveHdriSceneConfig,
  resolveHdriSlotFromMinutes,
  resolveHdriUrlFromMinutes,
  type HdriTimeSlot,
} from "@/lib/simulator/assets";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";

const FALLBACK_BG = "#1a2030";

interface LoadedHdri {
  slot: HdriTimeSlot;
  url: string;
  equirect: THREE.DataTexture;
  envMap: THREE.Texture;
}

function disposeLoadedHdri(loaded: LoadedHdri | null): void {
  if (!loaded) return;
  loaded.equirect.dispose();
  loaded.envMap.dispose();
}

function applyHdriToScene(
  scene: THREE.Scene,
  loaded: LoadedHdri,
): void {
  const cfg = resolveHdriSceneConfig(loaded.slot);

  scene.environment = loaded.envMap;
  scene.environmentIntensity = cfg.environmentIntensity;

  if (cfg.useBackground) {
    scene.background = loaded.equirect;
    scene.backgroundIntensity = cfg.backgroundIntensity;
  } else {
    scene.background = new THREE.Color(FALLBACK_BG);
    scene.backgroundIntensity = 1;
  }
}

function applyNeutralFallback(scene: THREE.Scene): void {
  scene.environment = null;
  scene.environmentIntensity = 1;
  scene.background = new THREE.Color(FALLBACK_BG);
  scene.backgroundIntensity = 1;
}

/**
 * IBL desde HDRI según hora del día.
 * Sin ambientLight genérico: scene.environment + luz direccional solar.
 */
function PhotographicHdriEnvironmentInner() {
  const { gl, scene } = useThree();
  const activeSlotRef = useRef<HdriTimeSlot | null>(null);
  const loadedRef = useRef<LoadedHdri | null>(null);
  const loadingUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disposeLoadedHdri(loadedRef.current);
      loadedRef.current = null;
      applyNeutralFallback(scene);
    };
  }, [scene]);

  useFrame(() => {
    const minutes = simulatorRuntime.timeOfDayMinutes;
    const slot = resolveHdriSlotFromMinutes(minutes);
    const url = resolveHdriUrlFromMinutes(minutes);

    if (activeSlotRef.current === slot && loadedRef.current?.url === url) return;
    if (loadingUrlRef.current === url) return;

    activeSlotRef.current = slot;
    loadingUrlRef.current = url;

    logHdriDev("select", {
      slot,
      label: getHdriSlotLabel(slot),
      url,
      minutes,
      time: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`,
    });

    void (async () => {
      const exists = await hdriFileExists(url);
      if (!mountedRef.current || loadingUrlRef.current !== url) return;

      if (!exists) {
        logHdriDev("missing", { slot, url });
        disposeLoadedHdri(loadedRef.current);
        loadedRef.current = null;
        applyNeutralFallback(scene);
        loadingUrlRef.current = null;
        return;
      }

      logHdriDev("loading", { slot, url });

      try {
        const { texture, envMap } = await loadHdriEnvironment(url, gl);
        if (!mountedRef.current || loadingUrlRef.current !== url) {
          texture.dispose();
          envMap.dispose();
          return;
        }

        logHdriDev("pmrem-ready", {
          slot,
          url,
          equirectSize: `${texture.image.width}×${texture.image.height}`,
        });

        disposeLoadedHdri(loadedRef.current);
        const loaded: LoadedHdri = { slot, url, equirect: texture, envMap };
        loadedRef.current = loaded;
        applyHdriToScene(scene, loaded);

        const cfg = resolveHdriSceneConfig(slot);
        logHdriDev("applied", {
          slot,
          url,
          environmentIntensity: cfg.environmentIntensity,
          backgroundIntensity: cfg.backgroundIntensity,
          useBackground: cfg.useBackground,
        });
      } catch (err) {
        logHdriDev("load-error", { slot, url, error: String(err) });
        disposeLoadedHdri(loadedRef.current);
        loadedRef.current = null;
        applyNeutralFallback(scene);
      } finally {
        if (loadingUrlRef.current === url) loadingUrlRef.current = null;
      }
    })();
  });

  return null;
}

export default function PhotographicHdriEnvironment() {
  return (
    <Suspense fallback={null}>
      <PhotographicHdriEnvironmentInner />
    </Suspense>
  );
}
