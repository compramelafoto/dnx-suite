import type { ContestPrizePresentation } from "./prize-presentation";

/**
 * Premios públicos Santa Fe en Foco 2026 (confirmados en Bases sfef-2026-bases-v2).
 * Por cada una de las cuatro categorías: 1.º / 2.º / 3.º.
 */
export const SANTA_FE_EN_FOCO_PUBLIC_PRIZES: ContestPrizePresentation[] = [
  {
    id: "sfef-2026-prize-1",
    title: "1.º Premio",
    shortDescription: "$500.000 por categoría",
    type: "CASH",
    status: "PUBLIC",
    scope: "CATEGORY",
    rank: "1.º",
    monetaryAmount: 500_000,
    currency: "ARS",
    featured: true,
    order: 1,
    rulesAnchor: "#bases",
  },
  {
    id: "sfef-2026-prize-2",
    title: "2.º Premio",
    shortDescription: "$400.000 por categoría",
    type: "CASH",
    status: "PUBLIC",
    scope: "CATEGORY",
    rank: "2.º",
    monetaryAmount: 400_000,
    currency: "ARS",
    featured: false,
    order: 2,
    rulesAnchor: "#bases",
  },
  {
    id: "sfef-2026-prize-3",
    title: "3.º Premio",
    shortDescription: "$300.000 por categoría",
    type: "CASH",
    status: "PUBLIC",
    scope: "CATEGORY",
    rank: "3.º",
    monetaryAmount: 300_000,
    currency: "ARS",
    featured: false,
    order: 3,
    rulesAnchor: "#bases",
  },
];

export function getSantaFeEnFocoPublicPrizes(): ContestPrizePresentation[] {
  return SANTA_FE_EN_FOCO_PUBLIC_PRIZES;
}
