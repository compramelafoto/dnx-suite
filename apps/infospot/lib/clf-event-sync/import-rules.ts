/**
 * Criterio de importación y convocatoria pública de fotógrafos.
 *
 * Regla final de importación (documentada en docs/infospot/21-…):
 * - Importar si visibility=PUBLIC AND archivedAt IS NULL AND shareSlug IS NOT NULL
 *   AND title no vacío AND startsAt presente.
 * - CLOSED se importa (sigue visible públicamente); no borra ficha Info Spot.
 * - Archivo CLF: no importar como nuevo; si ya existe vínculo → STALE + snapshot.
 * - PRIVATE/UNLISTED: no importar como nuevo; si ya vinculado → actualizar payload,
 *   retirar CTA/URL operativa, no borrar ficha.
 */

import type { ClfEventForSync } from "./types";

export function hasUsableCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // 0,0 casi siempre es placeholder inválido en AR
  if (lat === 0 && lng === 0) return false;
  return true;
}

export function isClfEventImportable(event: Pick<
  ClfEventForSync,
  "visibility" | "archivedAt" | "shareSlug" | "title" | "startsAt"
>): { importable: boolean; reason: string } {
  if (event.archivedAt != null) {
    return { importable: false, reason: "archived" };
  }
  if (event.visibility !== "PUBLIC") {
    return { importable: false, reason: `visibility_${event.visibility}` };
  }
  if (!event.shareSlug?.trim()) {
    return { importable: false, reason: "missing_shareSlug" };
  }
  if (!event.title?.trim()) {
    return { importable: false, reason: "missing_title" };
  }
  if (!event.startsAt) {
    return { importable: false, reason: "missing_startsAt" };
  }
  return { importable: true, reason: "ok" };
}

/**
 * True solo cuando el evento CLF busca fotógrafos de forma pública abierta.
 * Usado por la sección futura “Buscan fotógrafos”.
 */
export function isClfEventPublicPhotographerCall(event: {
  visibility: string;
  joinPolicy: string;
  archivedAt: Date | null;
  shareSlug: string | null;
  status: string;
  maxPhotographers: number | null;
  activePhotographerCount?: number | null;
}): boolean {
  if (event.visibility !== "PUBLIC") return false;
  if (event.joinPolicy !== "OPEN") return false;
  if (event.archivedAt != null) return false;
  if (!event.shareSlug?.trim()) return false;
  // CLOSED no admite nuevas inscripciones
  if (event.status !== "ACTIVE") return false;

  if (event.maxPhotographers != null) {
    const active = event.activePhotographerCount ?? 0;
    if (active >= event.maxPhotographers) return false;
  }
  return true;
}

/** Cupos disponibles (null = ilimitado / desconocido). */
export function availablePhotographerSlots(event: {
  maxPhotographers: number | null;
  activePhotographerCount?: number | null;
}): number | null {
  if (event.maxPhotographers == null) return null;
  const active = event.activePhotographerCount ?? 0;
  return Math.max(0, event.maxPhotographers - active);
}
