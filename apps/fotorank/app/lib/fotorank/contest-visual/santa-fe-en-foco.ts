import { buildSantaFeEnFocoPresentation } from "../contest-assets/santa-fe-en-foco-assets";
import { DEFAULT_CONTEST_VISUAL_THEME } from "./default-theme";
import type { ContestVisualTheme } from "./types";

/**
 * Tema + presentación Santa Fe en Foco — centralizado.
 * Paleta clara alineada al banner institucional (marfil / azul / celeste / naranja acento).
 * Inventario: docs/fotorank/santa-fe-en-foco-visual-assets.md
 */
const santaPresentation = buildSantaFeEnFocoPresentation();

export const SANTA_FE_EN_FOCO_VISUAL_THEME: ContestVisualTheme = {
  ...DEFAULT_CONTEST_VISUAL_THEME,
  id: "santa-fe-en-foco",
  backgroundColor: "#f7f4ef",
  surfaceColor: "#ffffff",
  surfaceElevatedColor: "#f0ebe3",
  foregroundColor: "#12141a",
  mutedForegroundColor: "#4a5560",
  primaryColor: "#0b3a6e",
  primaryForegroundColor: "#ffffff",
  secondaryColor: "#1ba3d9",
  borderColor: "#d9d2c8",
  focusColor: "#e85a2d",
  headingFontPreset: "sans",
  bodyFontPreset: "sans",
  borderRadiusPreset: "soft",
  sectionSpacingPreset: "comfortable",
  heroOverlayStrength: "none",
  heroDesktopUrl: "",
  heroMobileUrl: "",
  organizerLogoUrl: "",
  socialImageUrl: "",
  presentation: {
    ...santaPresentation,
    hero: {
      ...santaPresentation.hero,
      overlayStrength: "none",
      layout: "stacked",
      fitDesktop: "cover",
      fitMobile: "contain",
      minimumHeightPreset: "compact",
      textAlignment: "start",
      contentPosition: "bottom",
      desktop: santaPresentation.hero.desktop
        ? {
            ...santaPresentation.hero.desktop,
            objectFitDesktop: "cover",
            objectFitMobile: "contain",
          }
        : null,
      mobile: santaPresentation.hero.mobile
        ? {
            ...santaPresentation.hero.mobile,
            objectFitDesktop: "cover",
            objectFitMobile: "contain",
          }
        : null,
    },
    onHeroForegroundColor: "#12141a",
    onHeroMutedColor: "#4a5560",
  },
};

export function isSantaFeEnFocoSlug(slug: string): boolean {
  return slug.trim().toLowerCase() === "santa-fe-en-foco";
}
