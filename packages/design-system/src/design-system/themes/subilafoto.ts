/**
 * Tema Subí la Foto (modo oscuro)
 *
 * Fuente de verdad en CSS: `apps/subilafoto/app/globals.css` (`:root` `--slf-*`).
 * Es el único tema oscuro de la suite junto con FotoRank, y el único con un
 * fondo de color en lugar de negro: el púrpura del manual de marca.
 *
 * El acento es el amarillo, y se usa poco a propósito — en el manual es el
 * color de una sola cosa por pantalla. El violeta queda como acento secundario.
 *
 * Contrastes verificados contra el fondo `#200638`: texto 17,1:1, secundario
 * 10,8:1, `muted` 6,9:1, acento 12,9:1. El borde fuerte es `#8358c7` y no un
 * violeta más oscuro porque necesita 3:1 contra la superficie para que un
 * control se lea como control (da 3,37:1).
 */

export const themeSubiLaFoto = {
  colorScheme: "dark" as const,
  /** Marca — servido por la app Subí la Foto. Versión negativa: el fondo es oscuro. */
  assets: {
    wordmarkPublicPath: "/brand/subilafoto-logo-horizontal-negativo.png" as const,
    wordmarkWidth: 2400,
    wordmarkHeight: 720,
  },
  bg: "#200638",
  bgElevated: "#2b0a49",
  surface: "#2b0a49",
  surfaceHover: "#361059",
  surfaceMuted: "#2f0d4f",
  border: "#3d1a63",
  borderStrong: "#8358c7",
  borderMuted: "#2f0d4f",
  text: "#f8f6fc",
  textSecondary: "#d9b9ff",
  muted: "#b28fdb",
  mutedSoft: "#8f6bbd",
  accent: "#ffd51f",
  accentHover: "#f5c400",
  accentSoft: "rgba(255, 213, 31, 0.16)",
  accentMuted: "rgba(255, 213, 31, 0.10)",
  danger: "#ff9a9a",
  dangerSoft: "rgba(255, 154, 154, 0.12)",
  dangerBorder: "rgba(255, 154, 154, 0.4)",
  success: "#7ee2a8",
  successSoft: "rgba(126, 226, 168, 0.12)",
  successBorder: "rgba(126, 226, 168, 0.4)",
  warning: "#ffc46b",
  warningSoft: "rgba(255, 196, 107, 0.12)",
  warningBorder: "rgba(255, 196, 107, 0.4)",
  codeBg: "#2f0d4f",
  kbdBg: "#361059",
  radius: 12,
  radiusSm: 8,
  shadowSm: "0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)",
  /** Compat: “brand” es lo que consume el Button primario del design system. */
  brand: {
    primary: "#ffd51f",
    primaryHover: "#f5c400",
    accent: "#7c2bff",
    accentHover: "#6a17f0",
    soft: "rgba(255, 213, 31, 0.16)",
    gradient: "linear-gradient(135deg, #7c2bff 0%, #200638 100%)",
  },
} as const;

export type ThemeSubiLaFoto = typeof themeSubiLaFoto;
