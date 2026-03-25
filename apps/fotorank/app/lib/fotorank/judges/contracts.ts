import { parseCriteriaBasedMethodConfig } from "./criteriaBased";

export type JudgeMethodType =
  | "SCORE_1_5"
  | "SCORE_1_10"
  | "SCORE_0_100"
  | "YES_NO"
  | "FAVORITES_SELECTION"
  | "SELECTION_WITH_QUOTA"
  | "CRITERIA_BASED";

export type JudgeMethodConfig =
  | { type: "SCORE_1_5"; min: 1; max: 5; step: 1 }
  | { type: "SCORE_1_10"; min: 1; max: 10; step: 1 }
  | { type: "SCORE_0_100"; min: 0; max: 100; step: 1 }
  | { type: "YES_NO"; labels?: { yes: string; no: string } }
  | { type: "FAVORITES_SELECTION"; maxFavorites?: number }
  | { type: "SELECTION_WITH_QUOTA"; quota: number; tieBreak?: "none" | "manual" }
  | {
      type: "CRITERIA_BASED";
      criteria: Array<{ key: string; label: string }>;
      equalWeight: true;
      scale: { min: number; max: number; step: number };
    };


export function validateMethodConfig(methodType: JudgeMethodType, methodConfigJson: unknown): { valid: true } | { valid: false; error: string } {
  const cfg = (methodConfigJson ?? {}) as Record<string, unknown>;

  if (methodType === "SELECTION_WITH_QUOTA") {
    const quota = Number(cfg.quota ?? 0);
    if (!Number.isFinite(quota) || quota < 1) return { valid: false, error: "El método con cupo requiere quota >= 1." };
  }

  if (methodType === "CRITERIA_BASED") {
    const parsed = parseCriteriaBasedMethodConfig(methodConfigJson);
    if (!parsed.ok) return { valid: false, error: parsed.error };
    const eq = (cfg as { equalWeight?: unknown }).equalWeight;
    if (eq !== undefined && eq !== true) {
      return { valid: false, error: "El método por criterios debe usar el mismo peso para todos los criterios (equalWeight: true)." };
    }
  }

  return { valid: true };
}
