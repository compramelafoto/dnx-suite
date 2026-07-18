import type { VisualReference } from "../domain/visual-reference.js";
import type { VisualReferenceNiche } from "../domain/visual-reference-niche.js";
import { isDisplayableVisualReference } from "../validation/validate-visual-reference.js";

export const DEFAULT_VISUAL_REFERENCE_LIMIT = 6;

export type SelectVisualReferencesInput = {
  niche: VisualReferenceNiche;
  references: VisualReference[];
  limit?: number;
  previousReferenceIds?: string[];
  /** Skip file existence checks (unit tests with synthetic refs). */
  skipFileCheck?: boolean;
};

export type VisualReferenceSelectionResult = {
  niche: VisualReferenceNiche;
  selected: VisualReference[];
  availableCount: number;
  provider: "LOCAL_CURATED";
};

function orientationRank(orientation: string): number {
  if (orientation === "LANDSCAPE") return 0;
  if (orientation === "PORTRAIT") return 1;
  return 2;
}

/**
 * Selección determinista: filtra, evita repeticiones recientes,
 * prioriza diversidad de orientación y propósito educativo.
 */
export function selectVisualReferences(
  input: SelectVisualReferencesInput,
): VisualReferenceSelectionResult {
  const limit = Math.max(1, Math.min(input.limit ?? DEFAULT_VISUAL_REFERENCE_LIMIT, 6));
  const previous = new Set(input.previousReferenceIds ?? []);
  const opts = input.skipFileCheck
    ? { requireFileExists: false }
    : { requireFileExists: true };

  const eligible = input.references
    .filter((ref) => ref.niches.includes(input.niche))
    .filter((ref) => isDisplayableVisualReference(ref, opts))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const fresh = eligible.filter((ref) => !previous.has(ref.id));
  const pool = fresh.length > 0 ? fresh : eligible;

  const selected: VisualReference[] = [];
  const usedOrientations = new Set<string>();
  const usedPurposes = new Set<string>();

  const score = (ref: VisualReference): number => {
    let s = 0;
    if (!usedOrientations.has(ref.orientation)) s += 100;
    for (const p of ref.educationalPurpose) {
      if (!usedPurposes.has(p)) s += 10;
    }
    s += 3 - orientationRank(ref.orientation);
    return s;
  };

  const remaining = [...pool];
  while (selected.length < limit && remaining.length > 0) {
    remaining.sort((a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
    const next = remaining.shift()!;
    selected.push(next);
    usedOrientations.add(next.orientation);
    for (const p of next.educationalPurpose) usedPurposes.add(p);
  }

  return {
    niche: input.niche,
    selected,
    availableCount: eligible.length,
    provider: "LOCAL_CURATED",
  };
}
