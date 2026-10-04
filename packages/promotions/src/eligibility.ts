import type { PromotionEligibilityRule } from "./types";

/**
 * Lee la condición de elegibilidad guardada en `DnxPromotion.metadata`.
 *
 * Devuelve null cuando no hay condición o cuando está malformada: un cupón con
 * metadata rota se trata como cupón abierto, no como cupón roto. La protección
 * contra el olvido del llamador vive en el motor (fail-closed), no acá.
 */
export function readEligibilityRule(
  metadata: Record<string, unknown> | null,
): PromotionEligibilityRule | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as { eligibility?: unknown }).eligibility;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const candidate = raw as {
    kind?: unknown;
    editionIds?: unknown;
    requireCheckIn?: unknown;
  };
  if (candidate.kind !== "PARTICIPATED_IN_EDITION") return null;
  if (!Array.isArray(candidate.editionIds)) return null;

  const editionIds = candidate.editionIds.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0,
  );
  if (editionIds.length === 0) return null;

  return {
    kind: "PARTICIPATED_IN_EDITION",
    editionIds,
    requireCheckIn: candidate.requireCheckIn === true,
  };
}
