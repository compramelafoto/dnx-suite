/**
 * Reglas y parsing para el método de evaluación CRITERIA_BASED.
 * Usado en cliente (UI) y servidor (saveJudgeVote).
 */

export type CriteriaBasedParsed = {
  criteria: Array<{ key: string; label: string }>;
  scale: { min: number; max: number; step: number };
};

/** Config por defecto al crear asignaciones sin methodConfig explícito (misma escala para todos los criterios). */
export const DEFAULT_CRITERIA_BASED_METHOD_CONFIG = {
  type: "CRITERIA_BASED" as const,
  equalWeight: true as const,
  scale: { min: 1, max: 5, step: 1 },
  criteria: [
    { key: "technique", label: "Técnica" },
    { key: "creativity", label: "Creatividad" },
    { key: "composition", label: "Composición" },
    { key: "impact", label: "Impacto" },
  ],
};

function isNonEmptyObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length > 0;
}

/**
 * Normaliza y valida methodConfigJson guardado en la asignación.
 */
export function parseCriteriaBasedMethodConfig(
  methodConfigJson: unknown
): { ok: true; config: CriteriaBasedParsed } | { ok: false; error: string } {
  const cfg = isNonEmptyObject(methodConfigJson) ? methodConfigJson : {};
  const rawCriteria = Array.isArray(cfg.criteria) ? cfg.criteria : [];
  const criteria: Array<{ key: string; label: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < rawCriteria.length; i++) {
    const row = rawCriteria[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, error: `Criterio ${i + 1}: formato inválido.` };
    }
    const r = row as Record<string, unknown>;
    const key = String(r.key ?? "").trim();
    const label = String(r.label ?? "").trim() || key;
    if (!key) {
      return { ok: false, error: `Criterio ${i + 1}: falta la clave (key).` };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      return {
        ok: false,
        error: `Criterio «${key}»: la clave solo puede usar letras, números, guión bajo o guión medio.`,
      };
    }
    if (seen.has(key)) {
      return { ok: false, error: `Hay criterios duplicados con la clave «${key}».` };
    }
    seen.add(key);
    criteria.push({ key, label });
  }

  if (criteria.length === 0) {
    return {
      ok: false,
      error:
        "Esta asignación no tiene criterios configurados. Contactá al administrador para definir el método por criterios.",
    };
  }

  const scaleRaw =
    cfg.scale && typeof cfg.scale === "object" && !Array.isArray(cfg.scale)
      ? (cfg.scale as Record<string, unknown>)
      : {};
  const min = Number(scaleRaw.min ?? 1);
  const max = Number(scaleRaw.max ?? 5);
  const step = Number(scaleRaw.step ?? 1);

  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) {
    return { ok: false, error: "La escala de puntuación (min/max/paso) no es numérica válida." };
  }
  if (step <= 0) {
    return { ok: false, error: "El paso de la escala debe ser mayor que cero." };
  }
  if (min >= max) {
    return { ok: false, error: "En la escala, el mínimo debe ser menor que el máximo." };
  }

  return { ok: true, config: { criteria, scale: { min, max, step } } };
}

/**
 * Valida el objeto de puntajes contra la config parseada: mismas claves, sin extras, valores en rango y al paso.
 */
export function validateCriteriaScoresPayload(
  payload: unknown,
  parsed: CriteriaBasedParsed
): { ok: true; scores: Record<string, number> } | { ok: false; error: string } {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Los puntajes por criterio tienen un formato inválido." };
  }

  const obj = payload as Record<string, unknown>;
  const expected = new Set(parsed.criteria.map((c) => c.key));
  const keys = Object.keys(obj);

  for (const k of keys) {
    if (!expected.has(k)) {
      return { ok: false, error: `Hay un criterio no permitido en el voto: «${k}».` };
    }
  }

  for (const k of expected) {
    if (!(k in obj)) {
      const label = parsed.criteria.find((c) => c.key === k)?.label ?? k;
      return { ok: false, error: `Falta la puntuación obligatoria: ${label}.` };
    }
  }

  if (keys.length !== expected.size) {
    return { ok: false, error: "Debés enviar exactamente un valor por cada criterio configurado." };
  }

  const out: Record<string, number> = {};
  const { min, max, step } = parsed.scale;

  for (const k of expected) {
    const v = obj[k];
    const num = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
    if (!Number.isFinite(num)) {
      const label = parsed.criteria.find((c) => c.key === k)?.label ?? k;
      return { ok: false, error: `El valor de «${label}» no es un número válido.` };
    }
    if (num < min || num > max) {
      const label = parsed.criteria.find((c) => c.key === k)?.label ?? k;
      return {
        ok: false,
        error: `«${label}» debe estar entre ${min} y ${max}.`,
      };
    }
    const stepsFromMin = (num - min) / step;
    const rounded = Math.round(stepsFromMin);
    if (Math.abs(stepsFromMin - rounded) > 1e-9) {
      const label = parsed.criteria.find((c) => c.key === k)?.label ?? k;
      return {
        ok: false,
        error: `«${label}» debe respetar el paso de ${step} en la escala (entre ${min} y ${max}).`,
      };
    }
    out[k] = num;
  }

  return { ok: true, scores: out };
}
