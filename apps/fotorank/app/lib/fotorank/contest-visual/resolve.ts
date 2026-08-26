import { DEFAULT_CONTEST_VISUAL_THEME } from "./default-theme";
import { isSantaFeEnFocoSlug, SANTA_FE_EN_FOCO_VISUAL_THEME } from "./santa-fe-en-foco";
import {
  applyRuntimeMedia,
  mergePresentation,
  presentationOverlayStrength,
  type PresentationRuntimeOverride,
} from "./resolve-presentation";
import type { ContestVisualTheme, ContestVisualThemePartial } from "./types";

export { hasUsableImageUrl } from "./url";

export function mergeContestVisualTheme(
  base: ContestVisualTheme,
  override?: ContestVisualThemePartial | null,
): ContestVisualTheme {
  if (!override) return base;
  const { presentation: presentationOverride, ...rest } = override;
  return {
    ...base,
    ...rest,
    id: override.id ?? base.id,
    presentation: mergePresentation(base.presentation, presentationOverride),
  };
}

/**
 * Resuelve el tema visual del concurso.
 * Sin persistencia: presets en código por slug + override opcional en memoria.
 */
export function resolveContestVisualTheme(
  slug: string,
  override?: ContestVisualThemePartial | null,
  runtime?: PresentationRuntimeOverride,
): ContestVisualTheme {
  const base = isSantaFeEnFocoSlug(slug)
    ? SANTA_FE_EN_FOCO_VISUAL_THEME
    : DEFAULT_CONTEST_VISUAL_THEME;
  const merged = mergeContestVisualTheme(base, override);
  if (!runtime) return merged;
  return {
    ...merged,
    presentation: applyRuntimeMedia(merged.presentation, runtime),
  };
}

export function contestThemeToCssVars(theme: ContestVisualTheme): Record<string, string> {
  const radius =
    theme.borderRadiusPreset === "sharp"
      ? "0.25rem"
      : theme.borderRadiusPreset === "rounded"
        ? "1rem"
        : "0.5rem";

  const sectionPad =
    theme.sectionSpacingPreset === "compact"
      ? "2.25rem"
      : theme.sectionSpacingPreset === "spacious"
        ? "3.75rem"
        : "2.75rem";

  const sectionPadMd =
    theme.sectionSpacingPreset === "compact"
      ? "2.75rem"
      : theme.sectionSpacingPreset === "spacious"
        ? "4.5rem"
        : "3.5rem";

  const overlayStrength = presentationOverlayStrength(theme);
  const overlay =
    overlayStrength === "none"
      ? "0"
      : overlayStrength === "soft"
        ? "0.42"
        : overlayStrength === "strong"
          ? "0.78"
          : "0.58";

  const headingFont =
    theme.headingFontPreset === "display" || theme.headingFontPreset === "serif-pair"
      ? "var(--font-display)"
      : "var(--font-sans)";

  const bodyFont =
    theme.bodyFontPreset === "display" || theme.bodyFontPreset === "serif-pair"
      ? "var(--font-display)"
      : "var(--font-sans)";

  const heightPreset = theme.presentation.hero.minimumHeightPreset;
  const heroMin =
    heightPreset === "compact" ? "32.5rem" : heightPreset === "tall" ? "42rem" : "36rem";
  const heroMinMobile =
    heightPreset === "compact" ? "31.25rem" : heightPreset === "tall" ? "40rem" : "33.75rem";

  return {
    "--cv-background": theme.backgroundColor,
    "--cv-surface": theme.surfaceColor,
    "--cv-surface-elevated": theme.surfaceElevatedColor,
    "--cv-foreground": theme.foregroundColor,
    "--cv-muted-foreground": theme.mutedForegroundColor,
    "--cv-primary": theme.primaryColor,
    "--cv-primary-foreground": theme.primaryForegroundColor,
    "--cv-secondary": theme.secondaryColor,
    "--cv-border": theme.borderColor,
    "--cv-focus": theme.focusColor,
    "--cv-success": theme.successColor,
    "--cv-warning": theme.warningColor,
    "--cv-destructive": theme.destructiveColor,
    "--cv-radius": radius,
    "--cv-section-pad": sectionPad,
    "--cv-section-pad-md": sectionPadMd,
    "--cv-hero-overlay": overlay,
    "--cv-heading-font": headingFont,
    "--cv-body-font": bodyFont,
    "--cv-on-hero-fg": theme.presentation.onHeroForegroundColor,
    "--cv-on-hero-muted": theme.presentation.onHeroMutedColor,
    "--cv-hero-min-height": heroMin,
    "--cv-hero-min-height-mobile": heroMinMobile,
  };
}
