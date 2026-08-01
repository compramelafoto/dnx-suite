/**
 * Medidas oficiales de portada de edición (fuente de verdad).
 * Exportar siempre en estos píxeles para que banner, mobile y fichas no recorten mal.
 */

export const EDITION_COVER_HORIZONTAL = {
  width: 1920,
  height: 1080,
  aspectLabel: "16:9",
  /** Tailwind aspect utility */
  aspectClass: "aspect-video",
  /** Usos: banner home desktop, fichas/thumbnails, hero listados */
  uses: "Banner del Home (desktop), miniaturas y fichas de maratón",
  /** Zona segura: mantener textos/logos importantes dentro del 80% central */
  safeZoneNote:
    "Dejá márgenes: no pegues textos ni logos a los bordes (se puede recortar levemente en fichas).",
} as const;

export const EDITION_COVER_VERTICAL = {
  width: 1080,
  height: 1920,
  aspectLabel: "9:16",
  aspectClass: "aspect-[9/16]",
  /** Usos: banner home mobile, stories */
  uses: "Banner del Home (móvil) y stories",
  safeZoneNote:
    "Dejá márgenes arriba/abajo: el selector del banner puede tapar la franja inferior.",
} as const;

export function editionCoverHorizontalHint(): string {
  const { width, height, aspectLabel, uses } = EDITION_COVER_HORIZONTAL;
  return `Exacto ${width}×${height} px (${aspectLabel}). ${uses}. JPG/PNG/WEBP · máx. 8 MB.`;
}

export function editionCoverVerticalHint(): string {
  const { width, height, aspectLabel, uses } = EDITION_COVER_VERTICAL;
  return `Exacto ${width}×${height} px (${aspectLabel}). ${uses}. JPG/PNG/WEBP · máx. 8 MB.`;
}
