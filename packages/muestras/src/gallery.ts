import { MAX_HIGHLIGHTS, type GalleryMode } from "./constants";
import { temporalStatus } from "./dates";

/**
 * Qué obras ve el público.
 *
 * Mientras la muestra está próxima o abierta se ven sólo las destacadas, para que la galería
 * invite a ir y no reemplace la visita. Al cerrar se ve completa y queda como archivo.
 */
export function visibleWorks<W extends { isHighlight: boolean; sortOrder: number }>(
  a: { galleryMode: GalleryMode | string; startsAt: Date; endsAt: Date },
  works: W[],
  now: Date,
): { works: W[]; isPartial: boolean } {
  const ordered = [...works].sort((x, y) => x.sortOrder - y.sortOrder);
  if (a.galleryMode === "FULL" || temporalStatus(a, now) === "CLOSED") return { works: ordered, isPartial: false };
  const highlights = ordered.filter((w) => w.isHighlight);
  const shown = (highlights.length > 0 ? highlights : ordered).slice(0, MAX_HIGHLIGHTS);
  return { works: shown, isPartial: shown.length < ordered.length };
}
