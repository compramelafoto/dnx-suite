/**
 * Contrato visual reutilizable para concursos públicos.
 * ETAPA 01: tipado + tema en código. ETAPA 02: + presentación de medios.
 * Sin persistencia en DB.
 */

import type { ContestVisualPresentation, ContestVisualPresentationPartial } from "./presentation";

export type ContestFontPreset = "sans" | "display" | "serif-pair";
export type ContestRadiusPreset = "sharp" | "soft" | "rounded";
export type ContestSectionSpacingPreset = "compact" | "comfortable" | "spacious";
export type ContestHeroOverlayStrength = "none" | "soft" | "medium" | "strong";

export type ContestVisualTheme = {
  id: string;
  backgroundColor: string;
  surfaceColor: string;
  surfaceElevatedColor: string;
  foregroundColor: string;
  mutedForegroundColor: string;
  primaryColor: string;
  primaryForegroundColor: string;
  secondaryColor: string;
  borderColor: string;
  focusColor: string;
  successColor: string;
  warningColor: string;
  destructiveColor: string;
  headingFontPreset: ContestFontPreset;
  bodyFontPreset: ContestFontPreset;
  borderRadiusPreset: ContestRadiusPreset;
  sectionSpacingPreset: ContestSectionSpacingPreset;
  heroOverlayStrength: ContestHeroOverlayStrength;
  /** @deprecated Prefer presentation.hero — se mantiene por compat ETAPA 01 */
  heroDesktopUrl: string;
  /** @deprecated Prefer presentation.hero */
  heroMobileUrl: string;
  /** @deprecated Prefer presentation.identity.organizerLogo */
  organizerLogoUrl: string;
  /** @deprecated Prefer presentation.social */
  socialImageUrl: string;
  presentation: ContestVisualPresentation;
};

export type ContestVisualThemePartial = Partial<Omit<ContestVisualTheme, "presentation">> & {
  id?: string;
  presentation?: ContestVisualPresentationPartial;
};
