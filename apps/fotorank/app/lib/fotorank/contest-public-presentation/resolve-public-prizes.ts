import { isSantaFeEnFocoSlug } from "../contest-visual/santa-fe-en-foco";
import { parsePrizesRewardsConfig } from "../prizesRewards";
import {
  rewardsToPrizePresentations,
  toPublicPrizePresentations,
  type ContestPrizePresentation,
  type PublicCategoryRef,
} from "./prize-presentation";
import { getSantaFeEnFocoPublicPrizes } from "./santa-fe-en-foco-prizes";

/**
 * Resuelve premios públicos para la landing.
 * 1) Módulo estructurado rulesData.premiosRecompensas (visiblePublic).
 * 2) Preset temporal Santa Fe (hoy vacío).
 * No usa amounts del rules-config legal como fuente pública.
 */
export function resolvePublicContestPrizes(input: {
  contestSlug: string;
  rulesData: unknown;
  categories: PublicCategoryRef[];
}): ContestPrizePresentation[] {
  const cfg = parsePrizesRewardsConfig(input.rulesData);
  const fromModule = [
    ...toPublicPrizePresentations(cfg.prizes, input.categories),
    ...rewardsToPrizePresentations(cfg.rewards),
  ];
  if (fromModule.length > 0) return fromModule;

  if (isSantaFeEnFocoSlug(input.contestSlug)) {
    return getSantaFeEnFocoPublicPrizes();
  }
  return [];
}
