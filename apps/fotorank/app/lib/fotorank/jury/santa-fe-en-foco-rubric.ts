/**
 * Rúbrica staging Santa Fe en Foco — ETAPA 07.
 * PENDING_ORGANIZER_DECISION · BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR
 *
 * 5 criterios × peso 20 · escala 1–10.
 */
export const SANTA_FE_JURY_TERMS_VERSION = "sfef-jury-terms-draft-v1";

export const SANTA_FE_EN_FOCO_JURY_CRITERIA = [
  {
    key: "composition",
    name: "Composición",
    description: "Equilibrio, encuadre y organización visual de la imagen.",
    weight: 20,
    minScore: 1,
    maxScore: 10,
    step: 1,
    required: true,
    sortOrder: 10,
  },
  {
    key: "technique",
    name: "Técnica",
    description: "Dominio técnico: exposición, foco, nitidez y control del medio.",
    weight: 20,
    minScore: 1,
    maxScore: 10,
    step: 1,
    required: true,
    sortOrder: 20,
  },
  {
    key: "originality",
    name: "Originalidad",
    description: "Mirada propia, propuesta diferenciada y frescura creativa.",
    weight: 20,
    minScore: 1,
    maxScore: 10,
    step: 1,
    required: true,
    sortOrder: 30,
  },
  {
    key: "narrative_impact",
    name: "Narrativa o impacto",
    description: "Capacidad de contar, conmover o generar impacto visual.",
    weight: 20,
    minScore: 1,
    maxScore: 10,
    step: 1,
    required: true,
    sortOrder: 40,
  },
  {
    key: "thematic_relation",
    name: "Relación con la temática",
    description: "Pertinencia respecto del territorio, período y espíritu del concurso.",
    weight: 20,
    minScore: 1,
    maxScore: 10,
    step: 1,
    required: true,
    sortOrder: 50,
  },
] as const;

/** Mínimo de evaluaciones válidas por obra (configurable; staging Santa Fe). */
export const SANTA_FE_MIN_EVALUATIONS_PER_ENTRY = 3;

/** Tie-break canónico documentado (ranking-engine PRIORITY_CRITERION…). */
export const SANTA_FE_PRIORITY_CRITERION_KEY = "narrative_impact";
export const SANTA_FE_SECONDARY_CRITERION_KEY = "originality";
