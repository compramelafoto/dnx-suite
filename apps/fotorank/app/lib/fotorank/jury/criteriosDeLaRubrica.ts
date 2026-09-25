/**
 * Con qué criterios nace la rúbrica de un concurso.
 *
 * En producción la rúbrica nacía vacía —"configurar criterios antes de
 * activar"— y no había ninguna pantalla donde cargarlos. Sin criterios no se
 * activa; sin rúbrica activa no abre el juzgamiento. Ese era el tapón.
 *
 * Las maratones de Clickatón no tienen que configurar nada: sus cuatro
 * criterios y la escala están en las bases (1 a 10 × 4 criterios, mismo peso)
 * y valen para todas las ediciones. Un concurso de FotoRank que no tenga
 * rúbrica propia sigue naciendo vacío a propósito: nadie le inventa criterios
 * a un concurso ajeno.
 */
import { CLICKATON_2026_JURY_CRITERIA } from "./clickaton-2026-rubric";
import { SANTA_FE_EN_FOCO_JURY_CRITERIA } from "./santa-fe-en-foco-rubric";

export type CriterioDeRubrica = {
  key: string;
  name: string;
  description: string | null;
  weight: number;
  minScore: number;
  maxScore: number;
  step: number;
  required: boolean;
  sortOrder: number;
};

/** Qué mira cada criterio. El jurado lo lee mientras califica. */
const QUE_MIRA_CADA_CRITERIO: Record<string, string> = {
  prompt_fit: "Qué tanto la fotografía responde a lo que pedía la consigna.",
  composition_technique:
    "Encuadre, luz, foco y control del medio: cómo está construida y resuelta la imagen.",
  creativity_originality: "La mirada propia: qué tiene esta foto que no tienen las demás.",
  visual_impact: "Lo que provoca y lo que cuenta, más allá de la resolución técnica.",
};

/** Cuántos jurados miran cada obra cuando el equipo alcanza para repartir. */
export const CLICKATON_MIN_EVALUACIONES_POR_OBRA = 3;

const CLICKATON_CHANNEL = "CLICKATON";
const SANTA_FE_SLUG = "santa-fe-en-foco";

const CRITERIOS_DE_EJEMPLO: CriterioDeRubrica[] = [
  { key: "interpretation", name: "Interpretación de la consigna", weight: 30, sortOrder: 10 },
  { key: "creativity", name: "Creatividad", weight: 25, sortOrder: 20 },
  { key: "composition", name: "Composición", weight: 20, sortOrder: 30 },
  { key: "impact", name: "Impacto visual", weight: 15, sortOrder: 40 },
  { key: "technique", name: "Técnica", weight: 10, sortOrder: 50 },
].map((c) => ({
  ...c,
  description: "Criterio de ejemplo para probar. No es reglamento.",
  minScore: 1,
  maxScore: 10,
  step: 1,
  required: true,
}));

export function criteriosParaConcurso(input: {
  slug: string | null;
  distributionChannel: string | null;
  esProduccion: boolean;
}): CriterioDeRubrica[] | null {
  if (input.distributionChannel === CLICKATON_CHANNEL) {
    return CLICKATON_2026_JURY_CRITERIA.map((c) => ({
      key: c.key,
      name: c.label,
      description: QUE_MIRA_CADA_CRITERIO[c.key] ?? null,
      weight: c.weight,
      minScore: c.minScore,
      maxScore: c.maxScore,
      step: 1,
      required: true,
      sortOrder: c.sortOrder,
    }));
  }

  if (input.slug === SANTA_FE_SLUG) {
    return SANTA_FE_EN_FOCO_JURY_CRITERIA.map((c) => ({
      key: c.key,
      name: c.name,
      description: c.description,
      weight: c.weight,
      minScore: c.minScore,
      maxScore: c.maxScore,
      step: c.step,
      required: c.required,
      sortOrder: c.sortOrder,
    }));
  }

  return input.esProduccion ? null : CRITERIOS_DE_EJEMPLO;
}

/**
 * Cuántas evaluaciones tiene que juntar cada obra.
 *
 * Tres, porque el desempate que ya está escrito ordena por mediana y por
 * dispersión: con dos notas no hay mediana que diga nada ni con qué comparar
 * a un jurado que se va de tono. Si el equipo es más chico, la miran todos.
 */
export function minimoDeEvaluacionesPorObra(cantidadDeJurados: number): number {
  if (!Number.isFinite(cantidadDeJurados) || cantidadDeJurados < 1) return 1;
  return Math.min(CLICKATON_MIN_EVALUACIONES_POR_OBRA, Math.floor(cantidadDeJurados));
}

/**
 * Los criterios que el organizador cargó en el concurso (pestaña Evaluación del
 * jurado, guardados en `rulesData.jurado.criteriaPreset`).
 *
 * Hasta el 2026-09-25 esa pestaña guardaba los criterios y nadie los leía: la
 * rúbrica de un concurso de FotoRank nacía vacía en producción. Ahora son la
 * fuente del tipo "Criterios del concurso".
 */
export function criteriosDesdeLasReglas(rulesData: unknown): CriterioDeRubrica[] | null {
  if (!rulesData || typeof rulesData !== "object") return null;
  const jurado = (rulesData as Record<string, unknown>).jurado;
  if (!jurado || typeof jurado !== "object") return null;
  const preset = (jurado as Record<string, unknown>).criteriaPreset;
  if (!Array.isArray(preset)) return null;
  const criterios = preset
    .filter(
      (c): c is { key: string; label: string; maxScore?: number; weight?: number } =>
        !!c && typeof c === "object" && typeof (c as { key?: unknown }).key === "string" &&
        typeof (c as { label?: unknown }).label === "string",
    )
    .map((c, i) => ({
      key: c.key,
      name: c.label,
      description: null,
      weight: typeof c.weight === "number" && c.weight > 0 ? c.weight : 1,
      minScore: 1,
      maxScore: typeof c.maxScore === "number" && c.maxScore > 1 ? c.maxScore : 10,
      step: 1,
      required: true,
      sortOrder: (i + 1) * 10,
    }));
  return criterios.length > 0 ? criterios : null;
}
