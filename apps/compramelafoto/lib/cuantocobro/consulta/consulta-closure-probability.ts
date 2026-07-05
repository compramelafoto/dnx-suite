/** Opciones de probabilidad de cierre para consultas comerciales (valor numérico interno). */
export const CC_CONSULTA_CLOSURE_PROBABILITY_OPTIONS = [
  {
    value: null,
    label: "Sin estimar todavía",
    description: "Aún no podés evaluar si este trabajo se concreta.",
  },
  {
    value: 25,
    label: "Baja",
    description: "Recién consultó o hay mucha incertidumbre todavía.",
  },
  {
    value: 50,
    label: "Media",
    description: "Hay interés real, pero falta avanzar en precio o fecha.",
  },
  {
    value: 75,
    label: "Alta",
    description: "Muy probable que cierre si seguís el seguimiento.",
  },
  {
    value: 95,
    label: "Muy alta",
    description: "Casi confirmado: falta seña, firma o un último detalle.",
  },
] as const;

const NUMERIC_CLOSURE_VALUES = CC_CONSULTA_CLOSURE_PROBABILITY_OPTIONS.map((opt) => opt.value).filter(
  (v): v is 25 | 50 | 75 | 95 => typeof v === "number",
);

export function formatConsultaClosureProbability(probability: number | null | undefined): string {
  if (probability == null) return "Sin estimar";

  const exact = CC_CONSULTA_CLOSURE_PROBABILITY_OPTIONS.find((opt) => opt.value === probability);
  if (exact) return exact.label;

  const closest = resolveClosestClosureProbabilityValue(probability);
  const match = CC_CONSULTA_CLOSURE_PROBABILITY_OPTIONS.find((opt) => opt.value === closest);
  return match ? `${match.label} (≈${probability}%)` : `${probability}%`;
}

export function resolveClosestClosureProbabilityValue(probability: number): number {
  let closest = NUMERIC_CLOSURE_VALUES[0];
  let minDiff = Math.abs(probability - closest);

  for (const value of NUMERIC_CLOSURE_VALUES) {
    const diff = Math.abs(probability - value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = value;
    }
  }

  return closest;
}

export function resolveClosureProbabilitySelectValue(probability: number | null | undefined): string {
  if (probability == null) return "";
  const exact = CC_CONSULTA_CLOSURE_PROBABILITY_OPTIONS.some((opt) => opt.value === probability);
  if (exact) return String(probability);
  return String(resolveClosestClosureProbabilityValue(probability));
}

export function parseClosureProbabilitySelectValue(value: string): number | null {
  if (!value.trim()) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}
