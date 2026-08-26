import { createHash } from "node:crypto";
import { ADMISSION_RULES_VERSION } from "./types";

/**
 * Selection hash determinista para dry-run → apply.
 * Formato: `sha256:v1:<hex>`
 * Material: contestId | categorySlugsSorted | entryIdsSorted | rulesVersion | expectedCount
 * Sin PII ni secretos.
 */
export function buildFreezeSelectionHash(input: {
  contestId: string;
  categorySlugs: string[];
  entryIds: string[];
  rulesVersion?: string;
  expectedCount: number;
}): string {
  const cats = [...new Set(input.categorySlugs.map((s) => s.trim()).filter(Boolean))].sort();
  const ids = [...new Set(input.entryIds.map((s) => s.trim()).filter(Boolean))].sort();
  if (ids.length !== input.expectedCount) {
    throw new Error(
      `SELECTION_COUNT_MISMATCH: expectedCount=${input.expectedCount} ids=${ids.length}`,
    );
  }
  const material = [
    "freeze-selection:v1",
    input.contestId,
    cats.join(","),
    ids.join(","),
    input.rulesVersion ?? ADMISSION_RULES_VERSION,
    String(input.expectedCount),
  ].join("|");
  const hex = createHash("sha256").update(material).digest("hex");
  return `sha256:v1:${hex}`;
}

export function assertSelectionHashMatch(expected: string, actual: string): void {
  if (!expected || !actual || expected !== actual) {
    throw new Error("SELECTION_HASH_MISMATCH");
  }
}
