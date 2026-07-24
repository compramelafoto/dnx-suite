import type { AudiencePreview, NotificationCandidate } from "./contracts";
import { audiencePreviewSummary } from "./audience";

export type SelectionExplanation = {
  summary: string;
  scopeLabel: string;
  reasons: Array<{ eligibility: string; count: number }>;
  topEligible: Array<{
    userId: number | string | null | undefined;
    distanceKm: number | null;
    city: string | null;
    reason: string;
  }>;
};

/**
 * Explicabilidad de selección (agregados + muestra mínima).
 * No incluir emails/teléfonos/coords.
 */
export function explainAudienceSelection(
  preview: AudiencePreview,
  options?: { sampleSize?: number },
): SelectionExplanation {
  const sampleSize = options?.sampleSize ?? 5;
  const reasonMap = new Map<string, number>();
  for (const c of [...preview.eligible, ...preview.excluded]) {
    const key = c.eligibility;
    reasonMap.set(key, (reasonMap.get(key) ?? 0) + 1);
  }
  const reasons = [...reasonMap.entries()]
    .map(([eligibility, count]) => ({ eligibility, count }))
    .sort((a, b) => b.count - a.count);

  const topEligible = preview.eligible.slice(0, sampleSize).map((c) => ({
    userId: c.recipient.userId,
    distanceKm: c.distanceKm,
    city: c.city,
    reason: c.selectionReason,
  }));

  return {
    summary: audiencePreviewSummary(preview),
    scopeLabel: preview.scopeLabel,
    reasons,
    topEligible,
  };
}

export function explainCandidate(c: NotificationCandidate): string {
  if (c.eligibility === "ELIGIBLE") {
    const dist =
      c.distanceKm != null ? ` a ~${c.distanceKm} km` : c.city ? ` en ${c.city}` : "";
    return `Elegible${dist}: ${c.selectionReason}`;
  }
  return `Excluido (${c.eligibility}): ${c.excludeReason ?? c.selectionReason}`;
}
