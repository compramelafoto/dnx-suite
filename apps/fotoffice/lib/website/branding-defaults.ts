/** Defaults visuales seguros cuando `FotofficeWorkspaceBranding` todavía no tiene colores
 * cargados (campos opcionales, sin valor por defecto en el modelo). Nunca se persisten como
 * valor real — solo se usan para no renderizar con `undefined`/transparente. */
export const WEBSITE_DEFAULT_COLORS = {
  primaryColor: "#0ea5e9",
  secondaryColor: "#0f172a",
  backgroundColor: "#ffffff",
  textColor: "#0f172a",
  accentColor: "#0ea5e9",
} as const;

export type WebsiteColors = Record<keyof typeof WEBSITE_DEFAULT_COLORS, string>;

export function resolveWebsiteColors(branding: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  accentColor?: string | null;
} | null): WebsiteColors {
  return {
    primaryColor: branding?.primaryColor || WEBSITE_DEFAULT_COLORS.primaryColor,
    secondaryColor: branding?.secondaryColor || WEBSITE_DEFAULT_COLORS.secondaryColor,
    backgroundColor: branding?.backgroundColor || WEBSITE_DEFAULT_COLORS.backgroundColor,
    textColor: branding?.textColor || WEBSITE_DEFAULT_COLORS.textColor,
    accentColor: branding?.accentColor || WEBSITE_DEFAULT_COLORS.accentColor,
  };
}
