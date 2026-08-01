/**
 * Rúbrica canónica Clickatón 2026 (Bases / 10F.0).
 * 4 criterios, score 1–10. Jurado anónimo (identity hide en serialize-entry).
 */
export const CLICKATON_2026_JURY_CRITERIA = [
  {
    key: "prompt_fit",
    label: "Adecuación a la consigna",
    minScore: 1,
    maxScore: 10,
    weight: 1,
    sortOrder: 10,
  },
  {
    key: "composition_technique",
    label: "Composición y técnica",
    minScore: 1,
    maxScore: 10,
    weight: 1,
    sortOrder: 20,
  },
  {
    key: "creativity_originality",
    label: "Creatividad y originalidad",
    minScore: 1,
    maxScore: 10,
    weight: 1,
    sortOrder: 30,
  },
  {
    key: "visual_impact",
    label: "Impacto visual / narrativa",
    minScore: 1,
    maxScore: 10,
    weight: 1,
    sortOrder: 40,
  },
] as const;

export const CLICKATON_2026_FINALISTS_PER_PROMPT = 3;
export const CLICKATON_2026_MAX_FINALISTS = 30;
