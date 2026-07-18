import { readyCopies, type DaniCopyEntry } from "./dani-copy-catalog.js";
import { pickDeterministicCopy } from "./dani-pick-copy.js";
import type { DaniResponseContext } from "./dani-response-context.js";

export function selectReadyTransition(ctx: DaniResponseContext): DaniCopyEntry {
  return pickDeterministicCopy(
    readyCopies(),
    `${ctx.conversationId}:ready:${ctx.turnNumber}`,
    ctx.usedCopyIds,
  );
}

export function composeMessage(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
