import { z } from "zod";

/**
 * Presets de diseño global del sitio — controlados a propósito (nunca CSS libre): cada uno
 * mapea a un conjunto fijo de clases/tokens, no a un valor arbitrario que el usuario escriba.
 * Persisten en `FotofficeWorkspaceWebsite.designPresetsJson` (draft) y se congelan en
 * `FotofficeWorkspaceWebsiteVersion.designPresetsJson` al publicar (ver `change-status.ts` y
 * `app/actions/website.ts`) — una versión publicada conserva el diseño que tenía al publicarse,
 * aunque el draft siga cambiando después.
 */

export const HEADER_PRESETS = [
  { id: "logo-left", label: "Clásico", description: "Logo a la izquierda, menú a la derecha." },
  { id: "centered", label: "Centrado", description: "Logo centrado arriba, menú debajo." },
  { id: "minimal", label: "Minimal", description: "Solo logo y un botón de menú compacto." },
  { id: "transparent-hero", label: "Transparente", description: "Se superpone al Hero hasta hacer scroll." },
  { id: "floating", label: "Flotante", description: "Barra flotante, separada del borde superior." },
] as const;
export type HeaderPresetId = (typeof HEADER_PRESETS)[number]["id"];

export const BUTTON_PRESETS = [
  { id: "rounded", label: "Redondeado", radius: "0.5rem", paddingX: "1.25rem", paddingY: "0.625rem", fontWeight: 600 },
  { id: "pill", label: "Cápsula", radius: "9999px", paddingX: "1.5rem", paddingY: "0.625rem", fontWeight: 600 },
  { id: "square", label: "Recto", radius: "0px", paddingX: "1.25rem", paddingY: "0.625rem", fontWeight: 700 },
  { id: "soft", label: "Suave", radius: "0.25rem", paddingX: "1.125rem", paddingY: "0.5625rem", fontWeight: 500 },
] as const;
export type ButtonPresetId = (typeof BUTTON_PRESETS)[number]["id"];

export const TYPOGRAPHY_PRESETS = [
  {
    id: "institutional",
    label: "Institucional",
    description: "Títulos serif, cuerpo sans — sobria, de confianza.",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    headingWeight: 700,
    lineHeight: 1.4,
    letterSpacing: "normal",
  },
  {
    id: "modern",
    label: "Moderna",
    description: "Todo sans-serif, limpia y neutra.",
    headingFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    headingWeight: 700,
    lineHeight: 1.45,
    letterSpacing: "normal",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Títulos serif expresivos, con voz propia.",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Georgia, 'Times New Roman', serif",
    headingWeight: 700,
    lineHeight: 1.5,
    letterSpacing: "normal",
  },
  {
    id: "contemporary",
    label: "Contemporánea",
    description: "Sans geométrica, títulos grandes y directos.",
    headingFont: "'Helvetica Neue', Arial, sans-serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    headingWeight: 800,
    lineHeight: 1.35,
    letterSpacing: "-0.01em",
  },
  {
    id: "photographic",
    label: "Fotográfica",
    description: "Minimal, alto contraste — el protagonismo es la imagen.",
    headingFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    headingWeight: 300,
    lineHeight: 1.5,
    letterSpacing: "0.02em",
  },
] as const;
export type TypographyPresetId = (typeof TYPOGRAPHY_PRESETS)[number]["id"];

export const ANIMATION_PRESETS = [
  { id: "none", label: "Ninguna", description: "Sin transiciones — carga instantánea." },
  { id: "soft", label: "Suave", description: "Aparición suave de cada sección al hacer scroll." },
  { id: "dynamic", label: "Dinámica", description: "Aparición con más movimiento." },
] as const;
export type AnimationPresetId = (typeof ANIMATION_PRESETS)[number]["id"];

const HEADER_IDS = HEADER_PRESETS.map((p) => p.id) as [HeaderPresetId, ...HeaderPresetId[]];
const BUTTON_IDS = BUTTON_PRESETS.map((p) => p.id) as [ButtonPresetId, ...ButtonPresetId[]];
const TYPOGRAPHY_IDS = TYPOGRAPHY_PRESETS.map((p) => p.id) as [TypographyPresetId, ...TypographyPresetId[]];
const ANIMATION_IDS = ANIMATION_PRESETS.map((p) => p.id) as [AnimationPresetId, ...AnimationPresetId[]];

export const DEFAULT_DESIGN_PRESETS: WebsiteDesignPresets = {
  headerPreset: "logo-left",
  showLoginButton: false,
  loginButtonLabel: "Iniciar sesión",
  logoSizePx: 40,
  typographyPreset: "modern",
  buttonPreset: "rounded",
  animationPreset: "none",
};

/** NULL/ausente en la DB debe equivaler exactamente a estos defaults — por eso cada campo usa
 * `.catch(default)` en vez de `.optional()`: un JSON corrupto o de una versión vieja del schema
 * cae a un valor seguro en vez de romper la carga de la página. */
export const websiteDesignPresetsSchema = z.object({
  headerPreset: z.enum(HEADER_IDS).catch(DEFAULT_DESIGN_PRESETS.headerPreset),
  showLoginButton: z.boolean().catch(DEFAULT_DESIGN_PRESETS.showLoginButton),
  loginButtonLabel: z.string().max(40).catch(DEFAULT_DESIGN_PRESETS.loginButtonLabel),
  logoSizePx: z.number().int().min(24).max(96).catch(DEFAULT_DESIGN_PRESETS.logoSizePx),
  typographyPreset: z.enum(TYPOGRAPHY_IDS).catch(DEFAULT_DESIGN_PRESETS.typographyPreset),
  buttonPreset: z.enum(BUTTON_IDS).catch(DEFAULT_DESIGN_PRESETS.buttonPreset),
  animationPreset: z.enum(ANIMATION_IDS).catch(DEFAULT_DESIGN_PRESETS.animationPreset),
});

export type WebsiteDesignPresets = {
  headerPreset: HeaderPresetId;
  showLoginButton: boolean;
  loginButtonLabel: string;
  logoSizePx: number;
  typographyPreset: TypographyPresetId;
  buttonPreset: ButtonPresetId;
  animationPreset: AnimationPresetId;
};

/** Tolerante: `null`, `{}`, JSON corrupto o de un schema viejo — todos caen a defaults campo
 * por campo, nunca tumban la carga de la página (mismo criterio que `parseWebsiteSections`). */
export function parseWebsiteDesignPresets(raw: unknown): WebsiteDesignPresets {
  if (raw === null || typeof raw !== "object") return DEFAULT_DESIGN_PRESETS;
  const parsed = websiteDesignPresetsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_DESIGN_PRESETS;
}

export function getHeaderPreset(id: HeaderPresetId) {
  return HEADER_PRESETS.find((p) => p.id === id) ?? HEADER_PRESETS[0];
}
export function getButtonPreset(id: ButtonPresetId) {
  return BUTTON_PRESETS.find((p) => p.id === id) ?? BUTTON_PRESETS[0];
}
export function getTypographyPreset(id: TypographyPresetId) {
  return TYPOGRAPHY_PRESETS.find((p) => p.id === id) ?? TYPOGRAPHY_PRESETS[1];
}

/** CSS custom properties derivadas de los presets — el único lugar donde preset→CSS se traduce.
 * Lo consumen `WebsitePageRenderer` (contenido) y `WebsiteHeaderView` (header), así ambos
 * quedan visualmente consistentes sin duplicar la traducción preset→valor. */
export function websiteDesignCssVars(presets: WebsiteDesignPresets): Record<string, string> {
  const typography = getTypographyPreset(presets.typographyPreset);
  const button = getButtonPreset(presets.buttonPreset);
  return {
    "--wsite-heading-font": typography.headingFont,
    "--wsite-body-font": typography.bodyFont,
    "--wsite-heading-weight": String(typography.headingWeight),
    "--wsite-line-height": String(typography.lineHeight),
    "--wsite-letter-spacing": typography.letterSpacing,
    "--wsite-button-radius": button.radius,
    "--wsite-button-padding-x": button.paddingX,
    "--wsite-button-padding-y": button.paddingY,
    "--wsite-button-weight": String(button.fontWeight),
    "--wsite-logo-size": `${presets.logoSizePx}px`,
  };
}
