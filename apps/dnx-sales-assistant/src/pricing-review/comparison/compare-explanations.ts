export type ExplanationComparison = {
  clarityScore: number;
  lengthChars: { structured: number; dani: number };
  componentsMentioned: { structured: number; dani: number };
  assumptionsMentioned: { structured: number; dani: number };
  missingMentioned: { structured: number; dani: number };
  technicalTerms: { structured: number; dani: number };
  note: string;
};

const TECHNICAL = [
  "amortización",
  "factor comercial",
  "posicionamiento",
  "breakdown",
  "hourlyRate",
  "monthlyNeed",
];

function countMentions(text: string, needles: string[]): number {
  const lower = text.toLowerCase();
  return needles.filter((n) => lower.includes(n.toLowerCase())).length;
}

export function comparePricingExplanations(input: {
  structured: string;
  dani: string;
  componentNames: string[];
  assumptionLabels: string[];
  missingLabels: string[];
}): ExplanationComparison {
  const { structured, dani } = input;
  return {
    clarityScore: dani.length > 40 && dani.length < 900 ? 8 : 5,
    lengthChars: { structured: structured.length, dani: dani.length },
    componentsMentioned: {
      structured: countMentions(structured, input.componentNames),
      dani: countMentions(dani, input.componentNames),
    },
    assumptionsMentioned: {
      structured: countMentions(structured, input.assumptionLabels),
      dani: countMentions(dani, input.assumptionLabels),
    },
    missingMentioned: {
      structured: countMentions(structured, input.missingLabels),
      dani: countMentions(dani, input.missingLabels),
    },
    technicalTerms: {
      structured: countMentions(structured, TECHNICAL),
      dani: countMentions(dani, TECHNICAL),
    },
    note: "Comparación de claridad de explicación; no altera montos ni fórmulas.",
  };
}
