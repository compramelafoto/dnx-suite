import type { AssistantIntent } from "../models/assistant.js";
import { foldTextForIntent } from "./fold-text.js";
import { INTENT_RULES } from "./patterns.js";

export type IntentClassification = {
  intent: AssistantIntent;
  /** Regla que matcheó; null si UNKNOWN. */
  matchedIntent: AssistantIntent | null;
};

/**
 * Clasificación determinística por reglas.
 * Sin IA, sin precios, sin side-effects.
 */
export function classifyIntent(normalizedText: string): IntentClassification {
  const folded = foldTextForIntent(normalizedText);
  if (!folded) {
    return { intent: "UNKNOWN", matchedIntent: null };
  }

  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(folded)) {
        return { intent: rule.intent, matchedIntent: rule.intent };
      }
    }
  }

  return { intent: "UNKNOWN", matchedIntent: null };
}
