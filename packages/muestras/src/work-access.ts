import type { GalleryMode } from "./constants";
import { visibleWorks } from "./gallery";

/**
 * Qué se ve de una obra en su página pública.
 *
 * `FULL`: la imagen y los datos. `TEASER`: sólo los datos, sin la imagen, porque la galería
 * todavía la reserva para la visita. No es un 404 a propósito: el QR de la ficha de sala lleva
 * acá y se escanea durante la muestra, frente a la obra. La regla es la misma de la galería
 * (`visibleWorks`), así que galería, página de obra y perfil nunca se contradicen. En "para cada
 * visitante" (etapa 6), mientras la muestra no se revela, toda obra expuesta es `TEASER`: la
 * galería no tiene un conjunto fijo y una página con imagen dejaría indexar obras que cambian.
 */
export type WorkAccess = "FULL" | "TEASER";

type Gallery = { galleryMode: GalleryMode | string; visibility?: unknown; startsAt: Date; endsAt: Date };

export function workAccess<W extends { id: string; isHighlight: boolean; sortOrder: number }>(
  a: Gallery,
  works: W[],
  workId: string,
  now: Date,
): WorkAccess | null {
  if (!works.some((w) => w.id === workId)) return null;
  return visibleWorks(a, works, now).works.some((w) => w.id === workId) ? "FULL" : "TEASER";
}

export function workPath(slug: string, workId: string): string {
  return `/m/${encodeURIComponent(slug)}/o/${encodeURIComponent(workId)}`;
}

export function workUrl(baseUrl: string, slug: string, workId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${workPath(slug, workId)}`;
}

/** Anterior y siguiente entre las obras que se ven completas, para recorrer sin volver a la ficha. */
export function neighborWorks<W extends { id: string }>(visible: W[], workId: string): { prev: W | null; next: W | null } {
  const i = visible.findIndex((w) => w.id === workId);
  if (i < 0) return { prev: null, next: null };
  return { prev: visible[i - 1] ?? null, next: visible[i + 1] ?? null };
}
