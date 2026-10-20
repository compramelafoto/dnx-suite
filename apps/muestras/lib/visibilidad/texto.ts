import { parseVisibility, visibilitySummary } from "@repo/muestras";

/**
 * Qué ve el público online de las obras de la muestra, en una frase para el editor de la ficha.
 * Sin ajuste de sorpresa, como hasta la etapa 5 (destacadas o todas); con ajuste, lo que dice
 * Visibilidad (spec D24).
 */
export function queSeVeOnline(a: { visibility: unknown; galleryMode: string }): string {
  if (a.visibility == null) {
    return a.galleryMode === "FULL"
      ? "El público ve todas las obras online desde el primer día."
      : "Mientras la muestra está abierta, el público ve sólo las destacadas. Cuando cierra, quedan todas como archivo de la muestra.";
  }
  const r = visibilitySummary(parseVisibility(a.visibility, a.galleryMode));
  return `${r.online} ${r.afterClose}`;
}

/** Aviso fijo de reimprimir fichas (spec D37): sólo en Visibilidad y en Montaje e impresión. */
export const AVISO_FICHAS = "El pase de sala necesita las fichas con el QR nuevo. Si imprimiste fichas antes, volvé a bajarlas.";
