/**
 * Tema ComprameLaFoto
 * Color terroso/ocre primario. Prioriza light mode.
 *
 * `directory`: fichas de directorios públicos (fotógrafos, laboratorios) — alinear con `compositionSpacing.comprameLaFotoDirectory`.
 */

export const themeComprameLaFoto = {
  brand: {
    primary: "#A67341",
    primaryHover: "#B07D4F",
    accent: "#22c55e",
    accentHover: "#4ade80",
    soft: "rgba(166, 115, 65, 0.12)",
    gradient: "linear-gradient(135deg, #A67341 0%, #8B5E34 100%)",
  },
  /** Superficies y texto para tarjetas de listados públicos */
  directory: {
    pageBg: "#f7f5f2",
    sectionBg: "#f9fafb",
    cardBg: "#ffffff",
    /** Área del logo sobre la ficha */
    logoWell: "#f3f4f6",
    logoWellBorderBottom: "rgba(0, 0, 0, 0.06)",
    cardBorder: "rgba(0, 0, 0, 0.08)",
    text: "#111827",
    textMuted: "#6b7280",
    /** Acento UI (botones menú, hovers) — terracota */
    accent: "#c27b3d",
    accentHover: "#a86a33",
    accentSoft: "rgba(194, 123, 61, 0.14)",
    /** Enlaces “Ver perfil”, coherente con marca */
    link: "#A67341",
    linkHover: "#8B5E34",
    divider: "rgba(0, 0, 0, 0.06)",
    /** Chips / iconos redes */
    socialIconBg: "#f7f5f2",
    socialIconFg: "#6b7280",
  },
} as const;

export type ThemeComprameLaFoto = typeof themeComprameLaFoto;
