import type { ContestPrizePresentation } from "./prize-presentation";

/**
 * Preset temporal de premios públicos Santa Fe en Foco.
 *
 * VACÍO a propósito: no publicar importes ni piezas del rules-config
 * (p. ej. SFEF_PRIZE_* en santa-fe-en-foco-2026.ts) hasta confirmación
 * explícita de la organización y carga en el módulo de premios
 * (`rulesData.premiosRecompensas` con visiblePublic) o en este preset.
 *
 * Carácter temporal hasta persistencia / editor de premios.
 */
export const SANTA_FE_EN_FOCO_PUBLIC_PRIZES: ContestPrizePresentation[] = [];

export function getSantaFeEnFocoPublicPrizes(): ContestPrizePresentation[] {
  return SANTA_FE_EN_FOCO_PUBLIC_PRIZES;
}
