import type { BrainContext, BrainVerdict, EvaluatedRisk, Inconsistency } from "../types.js";

export interface RecommendationInput {
  context: BrainContext;
  verdict: BrainVerdict;
  score: number;
  confidence: number;
  risks: EvaluatedRisk[];
  inconsistencies: Inconsistency[];
  rejected: boolean;
}

export class Recommender {
  recommend(input: RecommendationInput): string {
    if (input.rejected) {
      return this.buildRejectionRecommendation(input);
    }

    switch (input.verdict) {
      case "approve":
        return this.buildApproveRecommendation(input);
      case "caution":
        return this.buildCautionRecommendation(input);
      case "reject":
        return this.buildRejectionRecommendation(input);
    }
  }

  private buildApproveRecommendation(input: RecommendationInput): string {
    const parts = [
      `Operación "${input.context.operation}" aprobada para ${input.context.platformName}`,
      `(score: ${String(input.score)}, confianza: ${formatConfidence(input.confidence)})`,
    ];

    if (input.context.dryRun) {
      parts.push("— simulación sin efectos en producción");
    }

    return parts.join(" ");
  }

  private buildCautionRecommendation(input: RecommendationInput): string {
    const riskCount = input.risks.length;
    const inconsistencyCount = input.inconsistencies.length;

    return [
      `Proceder con precaución en "${input.context.operation}" para ${input.context.platformName}`,
      `(score: ${String(input.score)}, confianza: ${formatConfidence(input.confidence)})`,
      `— ${String(riskCount)} riesgo(s) y ${String(inconsistencyCount)} inconsistencia(s) detectadas`,
    ].join(" ");
  }

  private buildRejectionRecommendation(input: RecommendationInput): string {
    const blocking = input.risks.filter((r) => r.blocking);
    const critical = input.inconsistencies.filter(
      (i) => i.severity === "critical" || i.severity === "high",
    );

    const reasons: string[] = [];
    if (blocking.length > 0) {
      reasons.push(`${String(blocking.length)} riesgo(s) bloqueante(s)`);
    }
    if (critical.length > 0) {
      reasons.push(`${String(critical.length)} inconsistencia(s) crítica(s)`);
    }
    if (input.score < 50) {
      reasons.push(`score insuficiente (${String(input.score)})`);
    }

    const reasonText =
      reasons.length > 0 ? reasons.join(", ") : "condiciones de seguridad no cumplidas";

    return `Rechazar "${input.context.operation}" en ${input.context.platformName}: ${reasonText}`;
  }
}

function formatConfidence(confidence: number): string {
  return `${String(Math.round(confidence * 100))}%`;
}
