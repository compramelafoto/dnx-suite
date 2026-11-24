"use client";

import { useEffect } from "react";
import { sumarPixelDelTurno } from "@/lib/turnos/meta-pixel";
import { isTrackingExcludedPath } from "@/lib/website/site-settings";

/** Suma el píxel de Meta adicional del tipo de turno a su página (no dibuja nada). */
export function PixelDelTurno({ pixelId }: { pixelId: string }) {
  useEffect(() => {
    if (isTrackingExcludedPath(window.location.pathname, window.location.search)) return;
    sumarPixelDelTurno(pixelId);
  }, [pixelId]);
  return null;
}
