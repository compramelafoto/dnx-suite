import type { PanelSectionKey } from "@repo/muestras";

/**
 * Lo que va a hacer cada sección del panel que todavía no está construida. Daniel quiere que
 * todas las funcionalidades estén a la vista: en vez de esconderlas, la página explica qué traen.
 */
export type TextoEnPreparacion = { titulo: string; bajada: string; puntos: string[] };

/** Etapa 8: "Ventas" quedó construida (cada muestra tiene la suya; el super admin ve todas). */
export const EN_PREPARACION: Partial<Record<PanelSectionKey, TextoEnPreparacion>> = {};
