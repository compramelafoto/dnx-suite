/**
 * Tema FotoRank
 * Dorado premium, prestigio. Prioriza dark mode.
 */

export const themeFotorank = {
  brand: {
    primary: "#d4af37",
    primaryHover: "#e5c04a",
    accent: "#c9a227",
    accentHover: "#d4af37",
    soft: "rgba(212, 175, 55, 0.12)",
    gradient: "linear-gradient(135deg, #d4af37 0%, #b8892d 100%)",
  },
} as const;

export type ThemeFotorank = typeof themeFotorank;
