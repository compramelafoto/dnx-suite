import type { CommunicationBrand } from "./types";

/**
 * Brandings mínimos de etapa 02.
 * CLF: acento #c27b3d auditado en apps/compramelafoto.
 * Clickatón: #FFE600 / #3B1F6E / negro / blanco.
 * DNX: paleta suite oscura + dorado (alineada a design tokens FotoRank/DNX).
 *
 * fotorank / infospot: preparados en el catálogo de IDs; no registrados aún.
 */
export const DNX_BRAND: CommunicationBrand = {
  id: "dnx",
  displayName: "DNX Suite",
  // Sin sitio ni soporte a propósito: esta marca se usa para comunicaciones
  // internas de plataforma, donde esos enlaces no aplican. Antes apuntaban a
  // example.com y se veían en el pie de los correos reales.
  primaryColor: "#d4af37",
  accentColor: "#e5c04a",
  backgroundColor: "#050505",
  surfaceColor: "#141414",
  textColor: "#fafafa",
  mutedTextColor: "#a1a1a1",
  buttonTextColor: "#050505",
  borderColor: "#262626",
  footerText: "DNX Suite — comunicaciones internas de plataforma.",
};

export const COMPRAMELAFOTO_BRAND: CommunicationBrand = {
  id: "compramelafoto",
  displayName: "ComprameLaFoto",
  websiteUrl: "https://example.com",
  supportEmail: "support@example.com",
  primaryColor: "#c27b3d",
  accentColor: "#a86a33",
  backgroundColor: "#f7f5f2",
  surfaceColor: "#ffffff",
  textColor: "#1a1a1a",
  mutedTextColor: "#6b7280",
  buttonTextColor: "#ffffff",
  borderColor: "#e5e7eb",
  footerText: "ComprameLaFoto — parte de DNX Suite.",
};

export const CLICKATON_BRAND: CommunicationBrand = {
  id: "clickaton",
  displayName: "Clickatón",
  websiteUrl: "https://example.com",
  supportEmail: "support@example.com",
  primaryColor: "#FFE600",
  accentColor: "#3B1F6E",
  backgroundColor: "#0a0a0a",
  surfaceColor: "#111111",
  textColor: "#ffffff",
  mutedTextColor: "#c4c4c4",
  buttonTextColor: "#0a0a0a",
  borderColor: "#3B1F6E",
  footerText: "Clickatón — parte de DNX Suite.",
};

export const DEFAULT_BRANDS: CommunicationBrand[] = [
  DNX_BRAND,
  COMPRAMELAFOTO_BRAND,
  CLICKATON_BRAND,
];
