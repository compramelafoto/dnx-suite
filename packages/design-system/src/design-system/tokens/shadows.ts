/**
 * Sombras suaves para dark UI.
 * Tres niveles de elevación visual.
 */

export const shadows = {
  sm: "0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2)",
  md: "0 4px 12px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3)",
  lg: "0 8px 24px rgba(0, 0, 0, 0.6), 0 4px 8px rgba(0, 0, 0, 0.4)",
} as const;

export type Shadows = typeof shadows;
