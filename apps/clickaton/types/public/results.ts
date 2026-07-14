/**
 * Resultados públicos — separados del evento estructural.
 * No implementar ranking ni UI en esta etapa.
 */

import type { ResultsStatus } from "@/types/marathon";

export type PublicResultMention = {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  recipientLabel: string;
};

export type PublicResultSelection = {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  entryIds: string[];
};

export type PublicRankingEntry = {
  position: number;
  tied?: boolean;
  entryId?: string;
  photographerCredit?: string;
  title?: string;
  scoreLabel?: string;
  categoryId?: string;
  prizeId?: string;
};

export type PublicCategoryRanking = {
  categoryId: string;
  categoryName: string;
  entries: PublicRankingEntry[];
};

export type PublicPrizeAward = {
  prizeId: string;
  title: string;
  categoryId?: string;
  recipientLabel: string;
  position?: number;
};

/**
 * Payload de resultados de una edición.
 * Mientras `status` no sea `published`, Clickaton no debe listar rankings.
 */
export type PublicMarathonResults = {
  marathonId: string;
  status: ResultsStatus;
  publishedAt?: string;
  generalRanking: PublicRankingEntry[];
  categoryRankings: PublicCategoryRanking[];
  mentions: PublicResultMention[];
  awards: PublicPrizeAward[];
  selections: PublicResultSelection[];
  /** Empates resueltos o declarados a nivel de edición. */
  hasTies: boolean;
  notes?: string;
  updatedAt: string;
};
