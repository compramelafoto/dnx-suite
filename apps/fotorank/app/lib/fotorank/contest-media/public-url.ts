/**
 * URL de una imagen de concurso y regla de visibilidad.
 *
 * Los bytes viven en storage privado, así que no hay URL directa: se sirven por
 * una ruta propia de FotoRank que decide en cada pedido si corresponde
 * mostrarlos. Eso es justamente lo que permite tener la imagen cargada mientras
 * el concurso sigue en borrador sin que quede expuesta.
 */

import type { ContestMediaKind } from "./specs";

/**
 * Estados en los que el concurso todavía no es público.
 *
 * DRAFT y SETUP_IN_PROGRESS son trabajo interno; READY_TO_PUBLISH es material
 * revisado pero aún no anunciado. En los tres, la imagen sólo se ve desde el
 * administrador.
 */
const NON_PUBLIC_CONTEST_STATUSES = new Set([
  "DRAFT",
  "SETUP_IN_PROGRESS",
  "READY_TO_PUBLISH",
]);

export function contestMediaIsPubliclyVisible(contestStatus: string): boolean {
  return !NON_PUBLIC_CONTEST_STATUSES.has(contestStatus.trim().toUpperCase());
}

/**
 * Ruta de servido de una imagen.
 *
 * Lleva el id del asset y no sólo el tipo, para que al reemplazar una imagen la
 * URL cambie. Si fuera fija (`.../media/banner`) los navegadores y las cachés
 * de WhatsApp o Facebook seguirían mostrando la anterior durante días.
 */
export function contestMediaUrl(contestId: string, assetId: string): string {
  return `/api/fotorank/contests/${encodeURIComponent(contestId)}/media/${encodeURIComponent(assetId)}`;
}

/** Versión absoluta, necesaria para Open Graph: las redes no resuelven rutas relativas. */
export function contestMediaAbsoluteUrl(
  contestId: string,
  assetId: string,
  baseUrl?: string | null,
): string {
  const path = contestMediaUrl(contestId, assetId);
  const base = (baseUrl ?? resolvePublicBaseUrl()).replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}

function resolvePublicBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (explicit?.trim()) return explicit.trim();
  const vercel = process.env.VERCEL_URL;
  if (vercel?.trim()) return `https://${vercel.trim()}`;
  return "https://fotorank.com";
}

export type ResolvedContestMedia = {
  kind: ContestMediaKind;
  url: string;
  alt: string;
  width: number;
  height: number;
  focalPointX: number;
  focalPointY: number;
};

/**
 * Selección con respaldo entre tipos.
 *
 * Si falta la imagen de tarjeta se usa el banner, y si falta la de compartir
 * también. Es preferible mostrar el banner en chico que no mostrar nada, y
 * ahorra tener que subir tres veces la misma pieza.
 */
export function pickContestMedia(
  media: Partial<Record<ContestMediaKind, ResolvedContestMedia>>,
  preferred: ContestMediaKind,
): ResolvedContestMedia | null {
  const order: ContestMediaKind[] =
    preferred === "BANNER"
      ? ["BANNER", "CARD", "SOCIAL"]
      : preferred === "CARD"
        ? ["CARD", "BANNER", "SOCIAL"]
        : ["SOCIAL", "BANNER", "CARD"];

  for (const kind of order) {
    const found = media[kind];
    if (found) return found;
  }
  return null;
}
