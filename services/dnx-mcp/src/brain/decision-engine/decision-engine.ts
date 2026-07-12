import {
  BLOCKING_OPERATIONS,
  KNOWLEDGE_RULES,
  OPERATION_MIN_SCORE,
  SCORE_THRESHOLDS,
} from "../knowledge/index.js";
import { InconsistencyDetector } from "../risk-engine/inconsistency-detector.js";
import { RiskEngine } from "../risk-engine/risk-engine.js";
import { ActionPlanner } from "../planner/planner.js";
import { Recommender } from "../recommendations/recommender.js";
import type {
  BrainDecision,
  BrainInput,
  BrainVerdict,
  EvaluatedRisk,
  Inconsistency,
} from "../types.js";

export interface DecisionEngineOptions {
  riskEngine?: RiskEngine;
  inconsistencyDetector?: InconsistencyDetector;
  planner?: ActionPlanner;
  recommender?: Recommender;
}

export class DecisionEngine {
  private readonly riskEngine: RiskEngine;
  private readonly inconsistencyDetector: InconsistencyDetector;
  private readonly planner: ActionPlanner;
  private readonly recommender: Recommender;

  constructor(options: DecisionEngineOptions = {}) {
    this.riskEngine = options.riskEngine ?? new RiskEngine();
    this.inconsistencyDetector = options.inconsistencyDetector ?? new InconsistencyDetector();
    this.planner = options.planner ?? new ActionPlanner();
    this.recommender = options.recommender ?? new Recommender();
  }

  evaluate(input: BrainInput): BrainDecision {
    const { context, signals } = input;

    const riskResult = this.riskEngine.evaluate(signals, context.operation);
    const inconsistencyResult = this.inconsistencyDetector.detect(context, signals);

    const score = calculateScore(riskResult.riskScorePenalty, inconsistencyResult.penalty, signals);
    const confidence = calculateConfidence(signals, inconsistencyResult.inconsistencies);
    const reasoning = buildReasoning(
      context,
      score,
      confidence,
      riskResult.risks,
      inconsistencyResult.inconsistencies,
    );

    const knowledgeRejected = applyKnowledgeRules(context, signals);
    const minScore = OPERATION_MIN_SCORE[context.operation];
    const scoreRejected = score < minScore;
    const blockingRejected =
      riskResult.hasBlockingRisk && BLOCKING_OPERATIONS.includes(context.operation);

    const rejected = knowledgeRejected || scoreRejected || blockingRejected;
    const verdict = resolveVerdict(score, rejected, context.dryRun ?? false);
    const shouldBlock = rejected || verdict === "reject";

    const recommendation = this.recommender.recommend({
      context,
      verdict,
      score,
      confidence,
      risks: riskResult.risks,
      inconsistencies: inconsistencyResult.inconsistencies,
      rejected,
    });

    const nextActions = this.planner.plan({
      context,
      verdict,
      risks: riskResult.risks,
      inconsistencies: inconsistencyResult.inconsistencies,
      rejected,
    });

    return {
      verdict,
      score,
      confidence,
      reasoning,
      recommendation,
      nextActions,
      risks: riskResult.risks,
      inconsistencies: inconsistencyResult.inconsistencies,
      rejected,
      shouldBlock,
      context,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

function calculateScore(
  riskPenalty: number,
  inconsistencyPenalty: number,
  signals: BrainInput["signals"],
): number {
  let score = 100 - riskPenalty - inconsistencyPenalty;

  const readySignals = signals.filter(
    (s) => s.type === "checklist" && s.value === true && s.key.includes("ready"),
  );
  score += Math.min(readySignals.length * 2, 10);

  const positiveHealth = signals.filter((s) => s.type === "health" && s.value === "healthy");
  score += Math.min(positiveHealth.length * 3, 6);

  return clamp(Math.round(score), 0, 100);
}

function calculateConfidence(
  signals: BrainInput["signals"],
  inconsistencies: Inconsistency[],
): number {
  if (signals.length === 0) {
    return 0.3;
  }

  let confidence = 0.5;

  const typedSignals = new Set(signals.map((s) => s.type));
  confidence += Math.min(typedSignals.size * 0.05, 0.2);

  confidence += Math.min(signals.length * 0.02, 0.15);

  const criticalInconsistencies = inconsistencies.filter((i) => i.severity === "critical").length;
  confidence -= criticalInconsistencies * 0.15;

  const signalsWithValue = signals.filter((s) => s.value !== undefined).length;
  confidence += Math.min(signalsWithValue * 0.01, 0.1);

  return clamp(Math.round(confidence * 100) / 100, 0.1, 0.99);
}

function resolveVerdict(score: number, rejected: boolean, dryRun: boolean): BrainVerdict {
  if (rejected) {
    return "reject";
  }
  if (dryRun) {
    return score >= SCORE_THRESHOLDS.approve ? "caution" : "reject";
  }
  if (score >= SCORE_THRESHOLDS.approve) {
    return "approve";
  }
  if (score >= SCORE_THRESHOLDS.caution) {
    return "caution";
  }
  return "reject";
}

function applyKnowledgeRules(
  context: BrainInput["context"],
  signals: BrainInput["signals"],
): boolean {
  const signalMap = new Map(signals.map((s) => [s.key, s]));

  for (const rule of KNOWLEDGE_RULES) {
    if (rule.effect !== "reject") {
      continue;
    }
    if ("operation" in rule.when && rule.when.operation !== context.operation) {
      continue;
    }
    if ("dryRun" in rule.when) {
      continue;
    }
    if (!("signalKey" in rule.when)) {
      continue;
    }

    const signal = signalMap.get(rule.when.signalKey);

    if (!signal) {
      if (
        rule.when.signalKey.startsWith("git.") ||
        rule.when.signalKey.startsWith("prisma.") ||
        rule.when.signalKey.startsWith("postgres.")
      ) {
        continue;
      }
      if ("expectValue" in rule) {
        return true;
      }
      continue;
    }

    if ("expectValue" in rule) {
      if (signal.value !== rule.expectValue) {
        return true;
      }
      continue;
    }

    if (signal.value === true) {
      return true;
    }
  }

  return false;
}

function buildReasoning(
  context: BrainInput["context"],
  score: number,
  confidence: number,
  risks: EvaluatedRisk[],
  inconsistencies: Inconsistency[],
): string[] {
  const lines: string[] = [
    `Evaluación de "${context.operation}" para plataforma "${context.platformId}"`,
    `Score calculado: ${String(score)}/100`,
    `Confianza: ${String(Math.round(confidence * 100))}%`,
    `Señales procesadas: riesgos=${String(risks.length)}, inconsistencias=${String(inconsistencies.length)}`,
  ];

  if (risks.length > 0) {
    const topRisks = risks
      .slice(0, 3)
      .map((r) => `[${r.level}] ${r.message}`)
      .join("; ");
    lines.push(`Riesgos principales: ${topRisks}`);
  }

  if (inconsistencies.length > 0) {
    const topInconsistencies = inconsistencies
      .slice(0, 2)
      .map((i) => i.description)
      .join("; ");
    lines.push(`Inconsistencias: ${topInconsistencies}`);
  }

  const minScore = OPERATION_MIN_SCORE[context.operation];
  if (score < minScore) {
    lines.push(`Score por debajo del mínimo requerido (${String(minScore)}) para esta operación`);
  }

  if (context.dryRun) {
    lines.push("Modo dryRun: no se autoriza ejecución real");
  }

  return lines;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
