"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";
import type { FocusMode } from "@/lib/simulator/focus-types";
import {
  getSimulatorNavSurface,
  isSimulatorPointerLocked,
} from "@/lib/simulator/simulator-nav-surface";
import { unlockSimulatorAudioFromGesture } from "@/lib/simulator/sound-engine";
import { useEffect, useRef } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function isSimulatorFocusSurface(target: EventTarget | null): boolean {
  if (isSimulatorPointerLocked()) return true;
  const nav = getSimulatorNavSurface();
  return nav instanceof HTMLElement && target instanceof Node && nav.contains(target);
}

function triggerFocusFromInput(
  focusMode: FocusMode,
  source: "click" | "keyboard",
  triggerAutofocus: (source: "click" | "keyboard") => void,
  setContinuousFocusActive: (active: boolean) => void,
): void {
  if (focusMode === "MF") return;
  unlockSimulatorAudioFromGesture();
  triggerAutofocus(source);
  if (focusMode === "AF_C") {
    setContinuousFocusActive(true);
  }
}

/**
 * V → cambiar área AF · C / click der. → enfocar · mantener C o click der. → seguimiento AF-C.
 * Funciona con Pointer Lock (no usa WASD).
 */
export default function SimulatorFocusKeyboardListener() {
  const { focus, cycleFocusArea, triggerAutofocus, setContinuousFocusActive } = useCameraStore();
  const focusRef = useRef(focus);
  focusRef.current = focus;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 2) return;
      if (isEditableTarget(event.target)) return;
      if (!isSimulatorFocusSurface(event.target)) return;

      event.preventDefault();
      const { focusMode } = focusRef.current;
      triggerFocusFromInput(focusMode, "click", triggerAutofocus, setContinuousFocusActive);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.button !== 2) return;
      setContinuousFocusActive(false);
    };

    const onContextMenu = (event: MouseEvent) => {
      if (!isSimulatorFocusSurface(event.target)) return;
      event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (event.code === "KeyV" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        cycleFocusArea();
        return;
      }

      if (event.code === "KeyC" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.repeat) return;
        event.preventDefault();
        const { focusMode } = focusRef.current;
        triggerFocusFromInput(focusMode, "keyboard", triggerAutofocus, setContinuousFocusActive);
        return;
      }

      if (event.code === "KeyF" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.repeat) return;
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        triggerAutofocus("keyboard");
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "KeyC") return;
      setContinuousFocusActive(false);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [cycleFocusArea, triggerAutofocus, setContinuousFocusActive]);

  return null;
}
