"use client";

import { EXPOSURE_COMP_PRESETS } from "@/lib/simulator/camera-defaults";
import { useCameraStore } from "@/lib/simulator/camera-store";
import type { CameraMode } from "@/lib/simulator/camera-types";
import { defaultCompare, stepOption } from "@/lib/simulator/param-step";
import { useCallback, useEffect, useRef, useState } from "react";

export const SIM_PARAM_COUNT = 8;

const VIEWFINDER_OPTIONS = ["live-view", "dslr-view"] as const;
const GUIDE_OPTIONS = ["none", "thirds", "center"] as const;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useSimulatorParamKeyboard(options?: {
  onOpenHelp?: () => void;
  /** Desactiva flechas cuando hay un modal abierto o la solapa no es Cámara. */
  disabled?: boolean;
}) {
  const {
    settings,
    presets,
    viewfinderMode,
    compositionGuide,
    showHistogram,
    setIso,
    setShutterSpeed,
    setAperture,
    setWhiteBalance,
    setMode,
    setExposureCompensation,
    setViewfinderMode,
    setCompositionGuide,
  } = useCameraStore();

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const uiRef = useRef({ viewfinderMode, compositionGuide, showHistogram });
  uiRef.current = { viewfinderMode, compositionGuide, showHistogram };

  const onOpenHelpRef = useRef(options?.onOpenHelp);
  onOpenHelpRef.current = options?.onOpenHelp;
  const disabledRef = useRef(options?.disabled ?? false);
  disabledRef.current = options?.disabled ?? false;

  const stepActiveParam = useCallback(
    (delta: -1 | 1) => {
      const s = settingsRef.current;
      const ui = uiRef.current;
      const idx = activeIndexRef.current;

      switch (idx) {
        case 0: {
          const next = stepOption(presets.iso, s.iso, delta);
          if (next !== null) setIso(next);
          break;
        }
        case 1: {
          if (s.mode === "A") break;
          const next = stepOption(presets.shutter, s.shutterSpeed, (delta * -1) as -1 | 1);
          if (next !== null) setShutterSpeed(next);
          break;
        }
        case 2: {
          if (s.mode === "S") break;
          const next = stepOption(presets.aperture, s.aperture, delta, defaultCompare);
          if (next !== null) setAperture(next);
          break;
        }
        case 3: {
          const next = stepOption(presets.whiteBalance, s.whiteBalance, delta);
          if (next !== null) setWhiteBalance(next);
          break;
        }
        case 4: {
          const next = stepOption(presets.modes, s.mode, delta);
          if (next !== null) setMode(next);
          break;
        }
        case 5: {
          const next = stepOption(EXPOSURE_COMP_PRESETS, s.exposureCompensation, delta, defaultCompare);
          if (next !== null) setExposureCompensation(next);
          break;
        }
        case 6: {
          const next = stepOption(VIEWFINDER_OPTIONS, ui.viewfinderMode, delta);
          if (next !== null) setViewfinderMode(next);
          break;
        }
        case 7: {
          const next = stepOption(GUIDE_OPTIONS, ui.compositionGuide, delta);
          if (next !== null) setCompositionGuide(next);
          break;
        }
        default:
          break;
      }
    },
    [
      presets,
      setIso,
      setShutterSpeed,
      setAperture,
      setWhiteBalance,
      setMode,
      setExposureCompensation,
      setViewfinderMode,
      setCompositionGuide,
    ],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (event.key === "?" || (event.shiftKey && event.code === "Slash")) {
        event.preventDefault();
        onOpenHelpRef.current?.();
        return;
      }

      if (disabledRef.current) return;

      switch (event.code) {
        case "ArrowUp":
          event.preventDefault();
          setActiveIndex((prev) => Math.max(0, prev - 1));
          break;
        case "ArrowDown":
          event.preventDefault();
          setActiveIndex((prev) => Math.min(SIM_PARAM_COUNT - 1, prev + 1));
          break;
        case "ArrowLeft":
          event.preventDefault();
          stepActiveParam(-1);
          break;
        case "ArrowRight":
          event.preventDefault();
          stepActiveParam(1);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepActiveParam]);

  return { activeIndex, setActiveIndex };
}

export type { CameraMode };
