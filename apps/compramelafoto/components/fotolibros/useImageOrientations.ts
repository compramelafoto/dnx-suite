"use client";

import { useEffect, useState } from "react";

export type Orientation = "H" | "V" | "S";

const RATIO = 1.15;

/**
 * Detecta orientación de una imagen según w/h.
 * H = horizontal (landscape), V = vertical (portrait), S = cuadrado.
 */
export function getOrientationFromDimensions(width: number, height: number): Orientation {
  if (width <= 0 || height <= 0) return "S";
  if (width > height * RATIO) return "H";
  if (height > width * RATIO) return "V";
  return "S";
}

type ImageRef = { id: string; url: string };

/**
 * Hook que carga cada imagen para detectar su orientación.
 * Retorna un Map de id → "H" | "V" | "S".
 */
export function useImageOrientations(images: ImageRef[]): Map<string, Orientation> {
  const [orientations, setOrientations] = useState<Map<string, Orientation>>(new Map());

  useEffect(() => {
    const ids = images.map((i) => i.id).join(",");
    const urls = images.map((i) => i.url).join("|");
    if (!ids) {
      setOrientations(new Map());
      return;
    }

    let cancelled = false;
    const next = new Map<string, Orientation>();

    const checkComplete = () => {
      if (cancelled) return;
      setOrientations(new Map(next));
    };

    let pending = images.length;
    images.forEach(({ id, url }) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        next.set(id, getOrientationFromDimensions(img.naturalWidth, img.naturalHeight));
        pending--;
        if (pending <= 0) checkComplete();
      };
      img.onerror = () => {
        if (cancelled) return;
        next.set(id, "S");
        pending--;
        if (pending <= 0) checkComplete();
      };
      img.src = url;
    });

    return () => {
      cancelled = true;
    };
  }, [images.length > 0 ? images.map((i) => `${i.id}:${i.url}`).join(",") : ""]);

  return orientations;
}
