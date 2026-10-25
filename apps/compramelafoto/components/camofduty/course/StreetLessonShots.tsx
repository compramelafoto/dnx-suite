"use client";

import { useEffect } from "react";
import { COD_LESSON_SHOT_EVENT, type CodLessonShotDetail } from "@/components/camofduty/course/LessonPanel";
import { buildStreetShot } from "@/lib/camofduty/course/build-shot";
import { COD_CAPTURE_IMAGE_EVENT, COD_SHOT_TAKEN_EVENT, type CodCaptureImageDetail, type CodShotTakenDetail } from "@/lib/simulator/capture-events";

/** Si la imagen procesada no llega (contexto gráfico perdido), se corrige igual. */
const IMAGE_WAIT_MS = 5000;

/**
 * Calle: arma la toma al obturar (con los ajustes de ese instante) y la manda a
 * corregir cuando llega la imagen procesada, que trae cuánto acompañó el barrido.
 */
export default function StreetLessonShots() {
  useEffect(() => {
    let cancel: (() => void) | null = null;
    const onShot = (e: Event) => {
      cancel?.();
      const shot = buildStreetShot((e as CustomEvent<CodShotTakenDetail>).detail.result);
      const send = () => {
        cleanup();
        window.dispatchEvent(new CustomEvent<CodLessonShotDetail>(COD_LESSON_SHOT_EVENT, { detail: { shot } }));
      };
      const onImage = (ev: Event) => {
        const panning = (ev as CustomEvent<CodCaptureImageDetail>).detail.panningMatch;
        shot.panningMatch = typeof panning === "number" ? panning : null;
        send();
      };
      const timer = window.setTimeout(send, IMAGE_WAIT_MS);
      const cleanup = () => {
        window.clearTimeout(timer);
        window.removeEventListener(COD_CAPTURE_IMAGE_EVENT, onImage);
        cancel = null;
      };
      window.addEventListener(COD_CAPTURE_IMAGE_EVENT, onImage, { once: true });
      cancel = cleanup;
    };
    window.addEventListener(COD_SHOT_TAKEN_EVENT, onShot);
    return () => {
      cancel?.();
      window.removeEventListener(COD_SHOT_TAKEN_EVENT, onShot);
    };
  }, []);
  return null;
}
