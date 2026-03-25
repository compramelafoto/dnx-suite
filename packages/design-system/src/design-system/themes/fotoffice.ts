/**
 * Tema FotoOffice
 * Profesional, oficina, funciona bien en light y dark.
 */

export const themeFotoffice = {
  brand: {
    primary: "#2563eb",
    primaryHover: "#3b82f6",
    accent: "#64748b",
    accentHover: "#94a3b8",
    soft: "rgba(37, 99, 235, 0.12)",
    gradient: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  },
} as const;

export type ThemeFotoffice = typeof themeFotoffice;
