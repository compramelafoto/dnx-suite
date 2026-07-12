import type { BrainSignal, EvaluatedRisk, SignalSeverity } from "../types.js";
import { BLOCKING_OPERATIONS, RISK_PATTERNS, RISK_WEIGHTS } from "../knowledge/index.js";

export interface RiskEvaluationResult {
  risks: EvaluatedRisk[];
  riskScorePenalty: number;
  hasBlockingRisk: boolean;
}

export class RiskEngine {
  evaluate(signals: BrainSignal[], operation: string): RiskEvaluationResult {
    const riskSignals = signals.filter(
      (s) => s.type === "risk" || s.type === "issue" || s.severity !== undefined,
    );

    const risks: EvaluatedRisk[] = [];
    let riskScorePenalty = 0;
    let hasBlockingRisk = false;

    for (const signal of riskSignals) {
      const evaluated = this.evaluateSignal(signal, operation);
      if (evaluated) {
        risks.push(evaluated);
        riskScorePenalty += evaluated.weight;
        if (evaluated.blocking) {
          hasBlockingRisk = true;
        }
      }
    }

    return {
      risks: dedupeRisks(risks),
      riskScorePenalty,
      hasBlockingRisk,
    };
  }

  private evaluateSignal(signal: BrainSignal, operation: string): EvaluatedRisk | null {
    const pattern = RISK_PATTERNS.find((p) => p.match.test(signal.message));
    const level = signal.severity ?? pattern?.defaultSeverity ?? inferSeverity(signal);
    const weight = RISK_WEIGHTS[level];
    const blocking =
      (pattern?.blocking ?? (level === "critical" || level === "high")) &&
      BLOCKING_OPERATIONS.includes(operation as (typeof BLOCKING_OPERATIONS)[number]);

    if (signal.type !== "risk" && signal.type !== "issue" && !signal.severity) {
      return null;
    }

    return {
      id: `risk-${signal.source}-${signal.key}`,
      level,
      source: signal.source,
      message: signal.message,
      weight,
      blocking,
    };
  }
}

function inferSeverity(signal: BrainSignal): SignalSeverity {
  if (signal.type === "issue") {
    return "high";
  }
  return "medium";
}

function dedupeRisks(risks: EvaluatedRisk[]): EvaluatedRisk[] {
  const seen = new Set<string>();
  return risks.filter((risk) => {
    const key = `${risk.source}:${risk.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
