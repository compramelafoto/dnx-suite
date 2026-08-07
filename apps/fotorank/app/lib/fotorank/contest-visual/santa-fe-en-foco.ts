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
  primaryColor: "#d4af37",
  primaryForegroundColor: "#0a0a0a",
  backgroundColor: "#070708",
  surfaceColor: "#121214",
  surfaceElevatedColor: "#1c1c20",
  mutedForegroundColor: "#c9c9cc",
  borderColor: "#2e2e33",
  headingFontPreset: "sans",
  bodyFontPreset: "sans",
  borderRadiusPreset: "soft",
  sectionSpacingPreset: "compact",
  heroOverlayStrength: "medium",
  heroDesktopUrl: "",
  heroMobileUrl: "",
  organizerLogoUrl: "",
  socialImageUrl: "",
  presentation: buildSantaFeEnFocoPresentation(),
};

export function isSantaFeEnFocoSlug(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  return s === "santa-fe-en-foco" || s.includes("santa-fe");
}
