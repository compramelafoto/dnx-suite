"use client";

import { useSyncExternalStore } from "react";
import type { CanvasDimUnit } from "@repo/template-editor-core";

/**
 * Unidad en la que el diseñador muestra el tamaño de los bloques (mm, cm o px). Es una
 * preferencia de quien diseña, no de la plantilla: la recuerda el navegador y la comparten
 * la etiqueta del lienzo y el inspector.
 */
const STORAGE_KEY = "dnx-template-editor:size-unit";
const DEFAULT_UNIT: CanvasDimUnit = "mm";

let current: CanvasDimUnit | null = null;
const listeners = new Set<() => void>();

function isUnit(v: unknown): v is CanvasDimUnit {
  return v === "mm" || v === "cm" || v === "px";
}

function read(): CanvasDimUnit {
  if (current) return current;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    current = isUnit(stored) ? stored : DEFAULT_UNIT;
  } catch {
    current = DEFAULT_UNIT;
  }
  return current;
}

export function setBlockSizeUnit(unit: CanvasDimUnit) {
  current = unit;
  try {
    window.localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // Sin almacenamiento (ventana privada): vale para esta sesión.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBlockSizeUnit(): CanvasDimUnit {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_UNIT);
}
