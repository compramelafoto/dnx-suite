/**
 * Rúbrica canónica Clickatón 2026 (ETAPA 15B — jury-and-public-voting-master-rules.md §5).
 * 3 criterios, pesos iguales, escala entera 1–10. Jurado anónimo (identity hide en serialize-entry).
 *
 * IMPORTANTE: 15B es la fuente funcional canónica; reemplaza la versión previa de 4 criterios
 * (Etapa 14 / CLICKATON_JURY_SCORING.md) cuando hay divergencia.
 */
export const CLICKATON_2026_JURY_CRITERIA = [
  {
    key: "interpretation",
    label: "Interpretación de la consigna",
    minScore: 1,
    maxScore: 10,
    weight: 1,
    sortOrder: 10,
  },
  {
    key: "creativity",
    label: "Creatividad / originalidad",
    minScore: 1,
    maxScore: 10,
    weight: 1,
    sortOrder: 20,
  },
  {
    key: "composition",
    label: "Composición / calidad fotográfica",
    minScore: 1,
    maxScore: 10,
    weight: 1,
    sortOrder: 30,
  },
] as const;

export const CLICKATON_2026_FINALISTS_PER_PROMPT = 3;
export const CLICKATON_2026_MAX_FINALISTS = 30;

/** Alias legacy (Etapa 14) — mantenido por compatibilidad de imports existentes. */
export const FINALISTS_PER_PROMPT = CLICKATON_2026_FINALISTS_PER_PROMPT;

/** Mínimo de evaluaciones independientes por obra (§5 master rules). */
export const CLICKATON_MIN_EVALUATIONS_PER_ENTRY = 3;

/** Mínimo de obras válidas/admisibles para competir (§3 master rules: 8 de 10). */
export const CLICKATON_MIN_VALID_ENTRIES = 8;

/** Carga recomendada por jurado (§6 master rules): 1 foto + criterios = 1 unidad de carga. */
export const CLICKATON_RECOMMENDED_MAX_ENTRIES_PER_JUDGE = 500;
