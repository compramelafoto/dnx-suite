import { z } from "zod";
import {
  baseTypographyLevels,
  compactTypographyLevels,
  googleFontsHref,
  resolveTypographyLevels,
  typographyCssVars,
  typographyLevelsSchema,
  type TypographyLevel,
  type TypographyLevelId,
  type TypographyLevels,
} from "./typography";

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

/** Variantes del pie del sitio. `simple` es el default: es el único que se ve bien sin ningún
 * dato de contacto cargado, y un workspace recién creado no tiene ninguno. */
export const FOOTER_PRESETS = [
  { id: "simple", label: "Simple", description: "Nombre, año y enlaces legales." },
  { id: "columns", label: "Columnas", description: "Menú, contacto y redes en columnas." },
  {
    id: "full",
    label: "Completo (publica la nota que usás en tus emails)",
    description:
      "Lo anterior, más el logo y la nota institucional del pie de los emails (razón social, CUIT, personería). Atención: esa nota queda visible para cualquiera en el sitio público.",
  },
] as const;
export type FooterPresetId = (typeof FOOTER_PRESETS)[number]["id"];

/** Dónde vive el menú. `topbar` es el de siempre y el único donde aplica `headerPreset`; en los
 * demás el encabezado queda reducido a logo + botón de menú (salvo `sidebar`, que en pantallas
 * grandes muestra el menú fijo al costado). En el celular, todas terminan en el botón de menú. */
export const MENU_LAYOUTS = [
  { id: "topbar", label: "Barra superior", description: "El menú en fila, arriba. Como hasta ahora." },
  { id: "drawer", label: "Panel lateral", description: "Un botón abre el menú deslizándose desde un costado." },
  { id: "sidebar", label: "Barra lateral fija", description: "El menú siempre visible a un costado, estilo portfolio." },
  { id: "fullscreen", label: "Pantalla completa", description: "Un botón abre el menú tapando toda la página, con ítems grandes al centro." },
  { id: "modal", label: "Panel central", description: "Un botón abre el menú en una tarjeta flotante al centro." },
] as const;
export type MenuLayoutId = (typeof MENU_LAYOUTS)[number]["id"];

export const MENU_SIDES = [
  { id: "left", label: "Izquierda" },
  { id: "right", label: "Derecha" },
] as const;
export type MenuSideId = (typeof MENU_SIDES)[number]["id"];

/** Sólo el panel lateral y la barra fija tienen un lado. */
export function menuLayoutHasSide(layout: MenuLayoutId): boolean {
  return layout === "drawer" || layout === "sidebar";
}

const HEADER_IDS = HEADER_PRESETS.map((p) => p.id) as [HeaderPresetId, ...HeaderPresetId[]];
const BUTTON_IDS = BUTTON_PRESETS.map((p) => p.id) as [ButtonPresetId, ...ButtonPresetId[]];
const TYPOGRAPHY_IDS = TYPOGRAPHY_PRESETS.map((p) => p.id) as [TypographyPresetId, ...TypographyPresetId[]];
const ANIMATION_IDS = ANIMATION_PRESETS.map((p) => p.id) as [AnimationPresetId, ...AnimationPresetId[]];
const FOOTER_IDS = FOOTER_PRESETS.map((p) => p.id) as [FooterPresetId, ...FooterPresetId[]];
const MENU_LAYOUT_IDS = MENU_LAYOUTS.map((p) => p.id) as [MenuLayoutId, ...MenuLayoutId[]];
const MENU_SIDE_IDS = MENU_SIDES.map((p) => p.id) as [MenuSideId, ...MenuSideId[]];

export const DEFAULT_DESIGN_PRESETS: WebsiteDesignPresets = {
  headerPreset: "logo-left",
  // Ya no se respeta: el botón para entrar se muestra siempre (ver `loginButtonText`). Queda en
  // el tipo para que los JSON guardados sigan leyéndose igual.
  showLoginButton: true,
  loginButtonLabel: "Ingresar",
  logoSizePx: 40,
  typographyPreset: "modern",
  buttonPreset: "rounded",
  animationPreset: "none",
  footerPreset: "simple",
  // Los sitios ya publicados no tenían estos campos: el default tiene que ser el menú de siempre.
  menuLayout: "topbar",
  menuSide: "right",
  // Sin cambios por nivel: cada nivel toma lo de su estilo de partida (ver `typography.ts`).
  typographyLevels: {},
};

/** NULL/ausente en la DB debe equivaler exactamente a estos defaults — por eso cada campo usa
 * `.catch(default)` en vez de `.optional()`: un JSON corrupto o de una versión vieja del schema
 * cae a un valor seguro en vez de romper la carga de la página. */
export const websiteDesignPresetsSchema = z.object({
  headerPreset: z.enum(HEADER_IDS).catch(DEFAULT_DESIGN_PRESETS.headerPreset),
  showLoginButton: z.boolean().catch(DEFAULT_DESIGN_PRESETS.showLoginButton),
  loginButtonLabel: z.string().max(40).catch(DEFAULT_DESIGN_PRESETS.loginButtonLabel),
  logoSizePx: z.number().int().min(24).max(160).catch(DEFAULT_DESIGN_PRESETS.logoSizePx),
  typographyPreset: z.enum(TYPOGRAPHY_IDS).catch(DEFAULT_DESIGN_PRESETS.typographyPreset),
  buttonPreset: z.enum(BUTTON_IDS).catch(DEFAULT_DESIGN_PRESETS.buttonPreset),
  animationPreset: z.enum(ANIMATION_IDS).catch(DEFAULT_DESIGN_PRESETS.animationPreset),
  footerPreset: z.enum(FOOTER_IDS).catch(DEFAULT_DESIGN_PRESETS.footerPreset),
  menuLayout: z.enum(MENU_LAYOUT_IDS).catch(DEFAULT_DESIGN_PRESETS.menuLayout),
  menuSide: z.enum(MENU_SIDE_IDS).catch(DEFAULT_DESIGN_PRESETS.menuSide),
  typographyLevels: typographyLevelsSchema.transform(compactTypographyLevels).catch({}),
});

export type WebsiteDesignPresets = {
  headerPreset: HeaderPresetId;
  showLoginButton: boolean;
  loginButtonLabel: string;
  logoSizePx: number;
  typographyPreset: TypographyPresetId;
  buttonPreset: ButtonPresetId;
  animationPreset: AnimationPresetId;
  footerPreset: FooterPresetId;
  menuLayout: MenuLayoutId;
  menuSide: MenuSideId;
  typographyLevels: TypographyLevels;
};

/** Tolerante: `null`, `{}`, JSON corrupto o de un schema viejo — todos caen a defaults campo
 * por campo, nunca tumban la carga de la página (mismo criterio que `parseWebsiteSections`). */
export function parseWebsiteDesignPresets(raw: unknown): WebsiteDesignPresets {
  if (raw === null || typeof raw !== "object") return DEFAULT_DESIGN_PRESETS;
  const parsed = websiteDesignPresetsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_DESIGN_PRESETS;
}

/** El texto que traían guardado todas las instituciones antes de que el botón pasara a "Ingresar". */
const LEGACY_LOGIN_LABEL = "Iniciar sesión";

/**
 * El texto del botón para entrar del encabezado del sitio.
 *
 * El botón ya no se puede apagar: es la puerta de los socios a su panel, y una institución que
 * lo había apagado (SFPR, por ejemplo) los dejaba sin forma visible de entrar. Lo que sí se
 * puede elegir es el texto.
 *
 * "Iniciar sesión" era el valor por defecto y quedó guardado en cada versión publicada aunque
 * nadie lo eligiera; se trata como "sin elegir" y pasa a "Ingresar". Cualquier otro texto se
 * respeta tal cual.
 */
export function loginButtonText(presets: Pick<WebsiteDesignPresets, "loginButtonLabel">): string {
  const label = presets.loginButtonLabel.trim();
  if (!label || label === LEGACY_LOGIN_LABEL) return DEFAULT_DESIGN_PRESETS.loginButtonLabel;
  return label;
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
export function getFooterPreset(id: FooterPresetId) {
  return FOOTER_PRESETS.find((p) => p.id === id) ?? FOOTER_PRESETS[0];
}

/** La tipografía de cada nivel ya resuelta: estilo de partida + lo que cambió el dueño. */
export function resolvedTypography(presets: WebsiteDesignPresets): Record<TypographyLevelId, TypographyLevel> {
  const typography = getTypographyPreset(presets.typographyPreset);
  const base = baseTypographyLevels({
    typographyPreset: presets.typographyPreset,
    headingWeight: typography.headingWeight,
    buttonWeight: getButtonPreset(presets.buttonPreset).fontWeight,
  });
  return resolveTypographyLevels(base, presets.typographyLevels);
}

/** La hoja de Google Fonts que necesita este diseño, o `null` si sólo usa letras del sistema. */
export function websiteFontsHref(presets: WebsiteDesignPresets): string | null {
  return googleFontsHref(resolvedTypography(presets));
}

/** CSS custom properties derivadas de los presets — el único lugar donde preset→CSS se traduce.
 * Lo consumen `WebsitePageRenderer` (contenido) y `WebsiteHeaderView` (header), así ambos
 * quedan visualmente consistentes sin duplicar la traducción preset→valor.
 *
 * `--wsite-heading-*` y `--wsite-body-*` siguen existiendo (los usan el blog, el pie y la página
 * de error): salen de los niveles "Títulos de sección" y "Texto". */
export function websiteDesignCssVars(presets: WebsiteDesignPresets): Record<string, string> {
  const typography = getTypographyPreset(presets.typographyPreset);
  const button = getButtonPreset(presets.buttonPreset);
  const niveles = typographyCssVars(resolvedTypography(presets));
  return {
    ...niveles,
    "--wsite-heading-font": niveles["--wsite-heading-font"],
    "--wsite-body-font": niveles["--wsite-body-font"],
    "--wsite-heading-weight": niveles["--wsite-heading-weight"],
    "--wsite-line-height": String(typography.lineHeight),
    "--wsite-letter-spacing": typography.letterSpacing,
    "--wsite-button-radius": button.radius,
    "--wsite-button-padding-x": button.paddingX,
    "--wsite-button-padding-y": button.paddingY,
    "--wsite-button-weight": niveles["--wsite-button-weight"],
    "--wsite-logo-size": `${presets.logoSizePx}px`,
  };
}
