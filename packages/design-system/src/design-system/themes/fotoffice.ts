/**
 * Tema Fotoffice (modo claro)
 * Fuente de verdad en CSS: `apps/fotoffice/app/globals.css` (`:root` `--fo-*`).
 * Logo oficial (PNG transparente): `apps/fotoffice/public/fotoffice.png` → URL `/fotoffice.png`.
 */

export const themeFotoffice = {
  colorScheme: "light" as const,
  /** Marca — servido por la app Fotoffice (sin fondo propio; ve el `--fo-bg` / `--fo-bg-elevated` de la vista). */
  assets: {
    wordmarkPublicPath: "/fotoffice.png" as const,
    wordmarkWidth: 1024,
    wordmarkHeight: 576,
  },
  bg: "#f4f6f9",
  bgElevated: "#ffffff",
  surface: "#ffffff",
  surfaceHover: "#f1f5f9",
  surfaceMuted: "#e8edf3",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  borderMuted: "#f1f5f9",
  text: "#0f172a",
  textSecondary: "#334155",
  muted: "#64748b",
  mutedSoft: "#94a3b8",
  accent: "#0ea5e9",
  accentHover: "#0284c7",
  accentSoft: "#e0f2fe",
  accentMuted: "rgba(14, 165, 233, 0.14)",
  danger: "#dc2626",
  dangerSoft: "rgba(220, 38, 38, 0.08)",
  dangerBorder: "rgba(220, 38, 38, 0.35)",
  success: "#15803d",
  successSoft: "rgba(22, 163, 74, 0.1)",
  successBorder: "rgba(22, 163, 74, 0.35)",
  warning: "#b45309",
  warningSoft: "rgba(245, 158, 11, 0.12)",
  warningBorder: "rgba(217, 119, 6, 0.4)",
  codeBg: "#f1f5f9",
  kbdBg: "#ffffff",
  radius: 12,
  radiusSm: 8,
  shadowSm:
    "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
  /** Compat: marca “brand” alineada al acento principal */
  brand: {
    primary: "#0ea5e9",
    primaryHover: "#0284c7",
    accent: "#64748b",
    accentHover: "#94a3b8",
    soft: "rgba(14, 165, 233, 0.14)",
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
  },
} as const;

export type ThemeFotoffice = typeof themeFotoffice;
