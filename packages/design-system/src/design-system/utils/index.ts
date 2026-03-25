/**
 * Utilidades: helpers, formateadores, cn (classnames), etc.
 * Funciones auxiliares para el diseño y los componentes.
 */

export const cn = (...classes: (string | undefined | false)[]): string =>
  classes.filter(Boolean).join(" ");

/** Oscurece un color hex (~12%) */
export function darken(hex: string, factor = 0.88): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export { useMediaQuery } from "./useMediaQuery";
