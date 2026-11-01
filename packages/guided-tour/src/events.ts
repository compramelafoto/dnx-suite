const EVENT_NAME = "dnx:guided-tour:start";

/** Pide abrir un recorrido desde cualquier parte de la pantalla (el botón de ayuda, un menú…). */
export function startGuidedTour(tourId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { id: tourId } }));
}

export function onGuidedTourStart(handler: (tourId: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (typeof id === "string") handler(id);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

/**
 * El recorrido con globos es solo para computadora: en pantallas chicas o táctiles el globo
 * tapa lo que explica. Ahí el botón de ayuda muestra la lista de consejos.
 */
export const DESKTOP_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

export function isDesktopViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(DESKTOP_QUERY).matches;
}
