import { ARGENTINA_2026_RULES } from "@/config/editions/argentina-2026";

export const AI_OR_MANIPULATION_SUSPECTED =
  ARGENTINA_2026_RULES.reviewFlagAiOrManipulation;

export type EditRuleKind = "ALLOWED" | "FORBIDDEN";

export function classifyEditTechnique(
  technique: string,
): EditRuleKind | "UNKNOWN" {
  const t = technique.trim().toLowerCase();
  if ((ARGENTINA_2026_RULES.editAllowed as readonly string[]).includes(t)) {
    return "ALLOWED";
  }
  if ((ARGENTINA_2026_RULES.editForbidden as readonly string[]).includes(t)) {
    return "FORBIDDEN";
  }
  return "UNKNOWN";
}

/** ML técnico (denoise, sharpen) no está en FORBIDDEN — no bloquear genéricamente. */
export function isGenericMlProcessingForbidden(): boolean {
  return false;
}

export function buildAiSuspectReviewFlag(reason: string): {
  flag: typeof AI_OR_MANIPULATION_SUSPECTED;
  reason: string;
  rawRequestAllowed: boolean;
} {
  return {
    flag: AI_OR_MANIPULATION_SUSPECTED,
    reason,
    rawRequestAllowed: ARGENTINA_2026_RULES.rawOptionalByDefault,
  };
}
