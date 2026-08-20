import { buildSantaFeEnFocoPresentation } from "../contest-assets/santa-fe-en-foco-assets";
import { DEFAULT_CONTEST_VISUAL_THEME } from "./default-theme";
import type { ContestVisualTheme } from "./types";

/**
 * Tema + presentación Santa Fe en Foco — centralizado.
 * La presentación se construye desde el manifiesto local
 * (`contest-assets/santa-fe-en-foco-assets.ts`), no desde la landing.
 * Inventario: docs/fotorank/santa-fe-en-foco-visual-assets.md
 */
export const SANTA_FE_EN_FOCO_VISUAL_THEME: ContestVisualTheme = {
  ...DEFAULT_CONTEST_VISUAL_THEME,
  id: "santa-fe-en-foco",
  primaryColor: "#0b3a6e",
  primaryForegroundColor: "#ffffff",
  backgroundColor: "#f7f4ef",
  surfaceColor: "#ffffff",
  surfaceElevatedColor: "#f0ebe3",
  mutedForegroundColor: "#4a5560",
  borderColor: "#d9d2c8",
  headingFontPreset: "sans",
  bodyFontPreset: "sans",
  borderRadiusPreset: "soft",
  sectionSpacingPreset: "compact",
  heroOverlayStrength: "none",
  heroDesktopUrl: "",
  heroMobileUrl: "",
  organizerLogoUrl: "",
  socialImageUrl: "",
  presentation: buildSantaFeEnFocoPresentation(),
};

export function isSantaFeEnFocoSlug(slug: string): boolean {
  return slug.trim().toLowerCase() === "santa-fe-en-foco";
}
