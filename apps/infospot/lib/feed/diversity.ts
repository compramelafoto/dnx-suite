/**
 * Diversificación moderada de tipos (sin aleatoriedad).
 */

import { FEED_CONFIG } from "./config";
import type { InfoSpotFeedItem, InfoSpotFeedItemType } from "./types";

/**
 * Limita rachas del mismo tipo cuando hay alternativas con score similar.
 * El ranking base manda: no degrada contenido urgente.
 */
export function diversifyFeedTypes<T extends Pick<InfoSpotFeedItem, "type" | "rankingScore" | "id">>(
  items: T[],
  options?: {
    maxConsecutive?: number;
    maxScoreDelta?: number;
  },
): T[] {
  if (items.length <= 2) return items;

  const maxConsecutive =
    options?.maxConsecutive ?? FEED_CONFIG.diversity.maxConsecutiveSameType;
  const maxScoreDelta =
    options?.maxScoreDelta ?? FEED_CONFIG.diversity.maxScoreDelta;

  const remaining = [...items];
  const result: T[] = [];

  while (remaining.length > 0) {
    let pickIndex = 0;

    if (result.length >= maxConsecutive) {
      const streakType = result[result.length - 1]!.type;
      let streak = 1;
      for (let i = result.length - 2; i >= 0; i -= 1) {
        if (result[i]!.type === streakType) streak += 1;
        else break;
      }

      if (streak >= maxConsecutive) {
        const headScore = remaining[0]!.rankingScore;
        const altIndex = remaining.findIndex(
          (item, idx) =>
            idx > 0 &&
            item.type !== streakType &&
            headScore - item.rankingScore <= maxScoreDelta,
        );
        if (altIndex > 0) pickIndex = altIndex;
      }
    }

    const [picked] = remaining.splice(pickIndex, 1);
    if (picked) result.push(picked);
  }

  return result;
}

export function countConsecutiveTypes(types: InfoSpotFeedItemType[]): number {
  if (types.length === 0) return 0;
  let max = 1;
  let cur = 1;
  for (let i = 1; i < types.length; i += 1) {
    if (types[i] === types[i - 1]) {
      cur += 1;
      max = Math.max(max, cur);
    } else {
      cur = 1;
    }
  }
  return max;
}
