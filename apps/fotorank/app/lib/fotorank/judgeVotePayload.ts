/**
 * Normalización y validación server-side del voto según methodType de la asignación.
 * Garantiza que no persistan campos mezclados ni valores fuera de rango.
 */

import { parseCriteriaBasedMethodConfig, validateCriteriaScoresPayload } from "./judges/criteriaBased";

export type NormalizedJudgeVotePayload = {
  valueNumeric: number | null;
  valueBoolean: boolean | null;
  isFavorite: boolean | null;
  selectedRank: number | null;
  criteriaScoresJson: unknown;
};

type RawVoteInput = {
  valueNumeric?: number | null;
  valueBoolean?: boolean | null;
  isFavorite?: boolean | null;
  selectedRank?: number | null;
  criteriaScoresJson?: unknown;
};

function emptyNonCriteria(): Omit<NormalizedJudgeVotePayload, "criteriaScoresJson"> {
  return {
    valueNumeric: null,
    valueBoolean: null,
    isFavorite: null,
    selectedRank: null,
  };
}

function parseQuota(methodConfigJson: unknown): number {
  if (!methodConfigJson || typeof methodConfigJson !== "object" || Array.isArray(methodConfigJson)) {
    return 1;
  }
  const q = Number((methodConfigJson as Record<string, unknown>).quota);
  if (!Number.isFinite(q) || q < 1) return 1;
  return Math.min(10_000, Math.floor(q));
}

function requireIntegerInRange(
  label: string,
  raw: unknown,
  min: number,
  max: number,
): { ok: true; value: number } | { ok: false; error: string } {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return { ok: false, error: `${label} no es un número válido.` };
  }
  if (!Number.isInteger(n)) {
    return { ok: false, error: `${label} debe ser un número entero.` };
  }
  if (n < min || n > max) {
    return { ok: false, error: `${label} debe estar entre ${min} y ${max}.` };
  }
  return { ok: true, value: n };
}

/**
 * Valida el cuerpo del voto alineado al método de la asignación.
 */
export function validateVotePayloadForMethod(
  methodType: string,
  methodConfigJson: unknown,
  raw: RawVoteInput,
): { ok: true; data: NormalizedJudgeVotePayload } | { ok: false; error: string } {
  switch (methodType) {
    case "SCORE_1_5": {
      const v = requireIntegerInRange("El puntaje", raw.valueNumeric, 1, 5);
      if (!v.ok) return v;
      return {
        ok: true,
        data: { ...emptyNonCriteria(), criteriaScoresJson: null, valueNumeric: v.value },
      };
    }
    case "SCORE_1_10": {
      const v = requireIntegerInRange("El puntaje", raw.valueNumeric, 1, 10);
      if (!v.ok) return v;
      return {
        ok: true,
        data: { ...emptyNonCriteria(), criteriaScoresJson: null, valueNumeric: v.value },
      };
    }
    case "SCORE_0_100": {
      const v = requireIntegerInRange("El puntaje", raw.valueNumeric, 0, 100);
      if (!v.ok) return v;
      return {
        ok: true,
        data: { ...emptyNonCriteria(), criteriaScoresJson: null, valueNumeric: v.value },
      };
    }
    case "YES_NO": {
      if (raw.valueBoolean === undefined || raw.valueBoolean === null) {
        return { ok: false, error: "Debés indicar Sí o No." };
      }
      return {
        ok: true,
        data: {
          ...emptyNonCriteria(),
          criteriaScoresJson: null,
          valueBoolean: Boolean(raw.valueBoolean),
        },
      };
    }
    case "FAVORITES_SELECTION": {
      const fav = raw.isFavorite === true || raw.isFavorite === false ? raw.isFavorite : Boolean(raw.isFavorite);
      return {
        ok: true,
        data: {
          ...emptyNonCriteria(),
          criteriaScoresJson: null,
          isFavorite: fav,
        },
      };
    }
    case "SELECTION_WITH_QUOTA": {
      const maxRank = parseQuota(methodConfigJson);
      const v = requireIntegerInRange("El ranking", raw.selectedRank, 1, maxRank);
      if (!v.ok) return v;
      return {
        ok: true,
        data: { ...emptyNonCriteria(), criteriaScoresJson: null, selectedRank: v.value },
      };
    }
    case "CRITERIA_BASED": {
      const parsed = parseCriteriaBasedMethodConfig(methodConfigJson);
      if (!parsed.ok) {
        return {
          ok: false,
          error:
            "La configuración del método por criterios de esta asignación no es válida. Contactá al administrador.",
        };
      }
      const validated = validateCriteriaScoresPayload(raw.criteriaScoresJson, parsed.config);
      if (!validated.ok) {
        return { ok: false, error: validated.error };
      }
      return {
        ok: true,
        data: {
          valueNumeric: null,
          valueBoolean: null,
          isFavorite: null,
          selectedRank: null,
          criteriaScoresJson: validated.scores,
        },
      };
    }
    default:
      return { ok: false, error: "Método de evaluación no soportado." };
  }
}

/**
 * Extrae valores crudos del FormData según methodType (misma convención que EvaluationClient).
 */
export function rawVoteInputFromFormData(
  formData: FormData,
  methodType: string,
  methodConfigJson: unknown,
): RawVoteInput {
  if (["SCORE_1_5", "SCORE_1_10", "SCORE_0_100"].includes(methodType)) {
    return { valueNumeric: Number(formData.get("valueNumeric")) };
  }
  if (methodType === "YES_NO") {
    return { valueBoolean: String(formData.get("valueBoolean")) === "yes" };
  }
  if (methodType === "FAVORITES_SELECTION") {
    return { isFavorite: formData.get("isFavorite") === "on" };
  }
  if (methodType === "SELECTION_WITH_QUOTA") {
    return { selectedRank: Number(formData.get("selectedRank")) };
  }
  if (methodType === "CRITERIA_BASED") {
    const parsed = parseCriteriaBasedMethodConfig(methodConfigJson);
    if (!parsed.ok) {
      return { criteriaScoresJson: {} };
    }
    const scores: Record<string, number> = {};
    for (const c of parsed.config.criteria) {
      scores[c.key] = Number(formData.get(`criterion_${c.key}`));
    }
    return { criteriaScoresJson: scores };
  }
  return {};
}
