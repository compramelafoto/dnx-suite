/** Valores de compensación de exposición en pasos de 0.5 EV. */
export const EXPOSURE_COMP_PRESETS = Array.from({ length: 13 }, (_, i) => -3 + i * 0.5) as readonly number[];

/** Modo de visor por defecto al restaurar. */
export const DEFAULT_VIEWFINDER_MODE = "dslr-view" as const;

/** Guía de composición por defecto al restaurar. */
export const DEFAULT_COMPOSITION_GUIDE = "thirds" as const;
