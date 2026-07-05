import type { AlbumMode } from "@/lib/prisma";

export type PackAvailabilityPhase = "PRE_UPLOAD" | "POST_UPLOAD";

export function isPackAvailabilityPhase(value: unknown): value is PackAvailabilityPhase {
  return value === "PRE_UPLOAD" || value === "POST_UPLOAD";
}

/**
 * Fase obligatoria para packs de preventa. Nunca devuelve null.
 * Álbumes SCHOOL y valores faltantes/inválidos → PRE_UPLOAD por defecto.
 */
export function resolvePackAvailabilityPhase(
  raw: unknown,
  albumMode?: AlbumMode | null
): PackAvailabilityPhase {
  if (isPackAvailabilityPhase(raw)) return raw;
  void albumMode;
  return "PRE_UPLOAD";
}

/** Devuelve error si el cliente envió un valor no reconocible (no null/undefined). */
export function parsePackAvailabilityPhaseFromRequest(
  raw: unknown,
  albumMode?: AlbumMode | null
): { phase: PackAvailabilityPhase } | { error: string } {
  if (isPackAvailabilityPhase(raw)) {
    return { phase: raw };
  }
  if (raw === null || raw === undefined || raw === "") {
    return { phase: resolvePackAvailabilityPhase(raw, albumMode) };
  }
  return {
    error:
      'La etapa del pack es obligatoria. Elegí "Antes de subir fotos" (PRE_UPLOAD) o "Después de subir fotos" (POST_UPLOAD).',
  };
}
