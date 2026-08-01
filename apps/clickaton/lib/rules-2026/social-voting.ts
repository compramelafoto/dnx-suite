/**
 * People's Choice: 72h exactas desde publishedAt.
 * Winner = mayor likes válidos; empate exacto → MANUAL_REVIEW_REQUIRED.
 * Social LIVE permanece OFF en esta etapa (capacidad only).
 */

export function votingClosesAt(publishedAt: Date, hours = 72): Date {
  return new Date(publishedAt.getTime() + hours * 60 * 60 * 1000);
}

export function isVotingOpen(input: {
  publishedAt: Date;
  votingClosesAt: Date;
  now: Date;
}): boolean {
  const t = input.now.getTime();
  return t >= input.publishedAt.getTime() && t < input.votingClosesAt.getTime();
}

export type SocialWinnerResolution =
  | { status: "WINNER"; winnerEntryId: string; likes: number }
  | { status: "MANUAL_REVIEW_REQUIRED"; tiedEntryIds: string[]; likes: number }
  | { status: "NO_ENTRIES" };

export function resolveWinnerByLikes(
  entries: Array<{ entryId: string; validLikes: number; invalidated?: boolean }>,
): SocialWinnerResolution {
  const valid = entries.filter((e) => !e.invalidated);
  if (valid.length === 0) return { status: "NO_ENTRIES" };
  let max = -1;
  for (const e of valid) max = Math.max(max, e.validLikes);
  const top = valid.filter((e) => e.validLikes === max);
  if (top.length === 1) {
    return { status: "WINNER", winnerEntryId: top[0]!.entryId, likes: max };
  }
  return {
    status: "MANUAL_REVIEW_REQUIRED",
    tiedEntryIds: top.map((e) => e.entryId),
    likes: max,
  };
}

export function selectTopFinalistsByScore(
  scored: Array<{ entryId: string; score: number; eligible: boolean }>,
  topN = 3,
): Array<{ entryId: string; ranking: number; score: number }> {
  const eligible = scored
    .filter((s) => s.eligible)
    .sort((a, b) => b.score - a.score || a.entryId.localeCompare(b.entryId));
  return eligible.slice(0, topN).map((e, i) => ({
    entryId: e.entryId,
    ranking: i + 1,
    score: e.score,
  }));
}
