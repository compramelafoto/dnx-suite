import type { RecommendationItem } from "../types";

export type FotorankContestRecSource = {
  id: number | string;
  title: string;
  slug?: string | null;
};

/** Stub — FotoRank aún sin geo rico. */
export function fotorankContestToRecommendationItem(
  contest: FotorankContestRecSource,
): RecommendationItem {
  return {
    id: `fotorank:contest:${contest.id}`,
    source: "FOTORANK",
    sourceEntityId: String(contest.id),
    contentType: "CONTEST",
    title: contest.title,
    publicUrl: contest.slug ? `/concursos/${contest.slug}` : null,
  };
}
