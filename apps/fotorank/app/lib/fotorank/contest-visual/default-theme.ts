import { emptyContestVisualPresentation } from "./presentation";
import type { ContestVisualTheme } from "./types";

/**
 * Tema visual base FotoRank para concursos públicos.
 * Colores alineados a tokens existentes; contraste pensado para WCAG AA sobre fondo oscuro.
 */
export const DEFAULT_CONTEST_VISUAL_THEME: ContestVisualTheme = {
  id: "fotorank-default",
  backgroundColor: "#050505",
  surfaceColor: "#141414",
  surfaceElevatedColor: "#1a1a1a",
  foregroundColor: "#fafafa",
  mutedForegroundColor: "#c4c4c4",
  primaryColor: "#d4af37",
  primaryForegroundColor: "#050505",
  secondaryColor: "#262626",
  borderColor: "#333333",
  focusColor: "#e5c04a",
  successColor: "#6ee7b7",
  warningColor: "#fbbf24",
  destructiveColor: "#fca5a5",
  headingFontPreset: "sans",
  bodyFontPreset: "sans",
  borderRadiusPreset: "soft",
  sectionSpacingPreset: "comfortable",
  heroOverlayStrength: "medium",
  heroDesktopUrl: "",
  heroMobileUrl: "",
  organizerLogoUrl: "",
  socialImageUrl: "",
  presentation: emptyContestVisualPresentation({ overlayStrength: "medium" }),
};
