/**
 * Estilo de las etiquetas cortas del menú (BETA, NUEVO, …).
 *
 * Un solo lugar para que el menú lateral (escritorio y celular) y el menú
 * horizontal pinten igual. "NUEVO" va destacado en verde esmeralda oscuro
 * (texto blanco con contraste AA); el resto conserva el azul de siempre.
 */

const BASE = "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

const DEFAULT_COLOR = "bg-blue-500 text-white";

const COLOR_BY_BADGE: Record<string, string> = {
  NUEVO: "bg-emerald-700 text-white shadow-sm ring-1 ring-emerald-800/30",
};

export function normalizeNavBadge(badge: string | null | undefined): string {
  return String(badge ?? "").trim().toUpperCase();
}

/** ¿La etiqueta es de las que se destacan? */
export function isHighlightedNavBadge(badge: string | null | undefined): boolean {
  return normalizeNavBadge(badge) in COLOR_BY_BADGE;
}

export function navBadgeClassName(badge: string | null | undefined): string {
  const color = COLOR_BY_BADGE[normalizeNavBadge(badge)] ?? DEFAULT_COLOR;
  return `${BASE} ${color}`;
}
