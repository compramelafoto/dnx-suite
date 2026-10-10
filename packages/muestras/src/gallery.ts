import type { GalleryMode } from "./constants";
import { onlineExhibitedWorks, parseVisibility } from "./visibility";

/**
 * Qué obras expuestas ve el público online.
 *
 * Hasta la etapa 5, mientras la muestra estaba próxima o abierta se veían sólo las destacadas, y
 * al cerrar quedaba completa como archivo. Desde la etapa 6 lo decide el ajuste de sorpresa
 * (`visibility`); una muestra sin ajuste se comporta exactamente como antes (spec D24). En "para
 * cada visitante" no devuelve obras: las trae `/api/m/<slug>/anticipo` (`perVisit` dice cuántas).
 */
export function visibleWorks<W extends { id: string; isHighlight: boolean; sortOrder: number }>(
  a: { galleryMode: GalleryMode | string; visibility: unknown; startsAt: Date; endsAt: Date },
  works: W[],
  now: Date,
): { works: W[]; isPartial: boolean; hiddenCount: number; perVisit: null | { count: number; total: number } } {
  const r = onlineExhibitedWorks(parseVisibility(a.visibility, a.galleryMode), a, works, now);
  if (r.mode === "PER_VISIT") return { works: [], isPartial: true, hiddenCount: r.total, perVisit: { count: r.count, total: r.total } };
  return { works: r.works, isPartial: r.isPartial, hiddenCount: r.hiddenCount, perVisit: null };
}
