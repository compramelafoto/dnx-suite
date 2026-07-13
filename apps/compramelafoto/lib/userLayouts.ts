/**
 * Disposiciones de diseño guardadas por el usuario.
 * Se aprende de las configuraciones que usa al cerrar el Editor de Página
 * y se sugieren al cambiar entre plantillas.
 */

import type { LayoutSlot, LayoutTemplate } from "@/components/fotolibros/layoutTemplates";
import type { FrameItem, Spread, AlbumSpec } from "@/components/fotolibros/types";

const STORAGE_KEY = "disenador-user-layouts";

export type UserLayout = LayoutTemplate & {
  usedCount: number;
  lastUsed: string; // ISO date
};

function loadUserLayouts(): UserLayout[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUserLayouts(layouts: UserLayout[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch (e) {
    console.warn("No se pudo guardar disposición del usuario:", e);
  }
}

/** Convierte los items del spread a slots normalizados. */
function itemsToSlots(items: FrameItem[], spec: AlbumSpec): LayoutSlot[] {
  const contentWidth = spec.pageWidth * 2;
  const contentHeight = spec.pageHeight;
  const offsetX = spec.bleed;
  const offsetY = spec.bleed;

  return items.map((item) => ({
    nx: (item.x - offsetX) / contentWidth,
    ny: (item.y - offsetY) / contentHeight,
    nw: item.width / contentWidth,
    nh: item.height / contentHeight,
  }));
}

/** Comprueba si dos layouts tienen la misma disposición (slots equivalentes dentro de tolerancia). */
function slotsMatch(a: LayoutSlot[], b: LayoutSlot[], tol = 0.02): boolean {
  if (a.length !== b.length) return false;
  return a.every((sa, i) => {
    const sb = b[i];
    return (
      Math.abs(sa.nx - sb.nx) < tol &&
      Math.abs(sa.ny - sb.ny) < tol &&
      Math.abs(sa.nw - sb.nw) < tol &&
      Math.abs(sa.nh - sb.nh) < tol
    );
  });
}

/**
 * Guarda la disposición actual del spread como preferencia del usuario.
 * Si ya existe una disposición similar, incrementa su contador de uso.
 */
export function saveUserLayoutFromSpread(spread: Spread, spec: AlbumSpec): void {
  const items = spread.items ?? [];
  if (items.length === 0) return;

  const slots = itemsToSlots(items, spec);
  const now = new Date().toISOString();
  const layouts = loadUserLayouts();

  const existing = layouts.findIndex((l) => slotsMatch(l.slots, slots));
  if (existing >= 0) {
    layouts[existing].usedCount += 1;
    layouts[existing].lastUsed = now;
  } else {
    layouts.push({
      id: `user-${Date.now()}`,
      name: `Mi disposición ${layouts.filter((l) => l.id.startsWith("user-")).length + 1}`,
      slots,
      usedCount: 1,
      lastUsed: now,
    });
  }

  saveUserLayouts(layouts);
}

/**
 * Obtiene las disposiciones del usuario para un número de slots.
 * Ordenadas por más usadas primero.
 */
export function getUserLayoutsForSlotCount(slotCount: number): UserLayout[] {
  return loadUserLayouts()
    .filter((l) => l.slots.length === slotCount)
    .sort((a, b) => b.usedCount - a.usedCount)
    .slice(0, 8); // Máximo 8 sugerencias
}
