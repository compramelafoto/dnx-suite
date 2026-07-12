export { DnxBrain, type DnxBrainOptions } from "./brain.js";

export { DecisionEngine, type DecisionEngineOptions } from "./decision-engine/index.js";
export { RiskEngine, InconsistencyDetector } from "./risk-engine/index.js";
export { ActionPlanner } from "./planner/index.js";
export { Recommender } from "./recommendations/index.js";
export { DecisionHistory } from "./history/index.js";

export {
  SCORE_THRESHOLDS,
  OPERATION_MIN_SCORE,
  RISK_WEIGHTS,
  KNOWLEDGE_RULES,
  RISK_PATTERNS,
} from "./knowledge/index.js";

export type {
  BrainVerdict,
  BrainOperation,
  BrainContext,
  BrainSignal,
  BrainInput,
  BrainDecision,
  BrainAction,
  EvaluatedRisk,
  Inconsistency,
  BrainEvaluateOptions,
  DecisionRecord,
  BrainStats,
  SignalSeverity,
  SignalType,
} from "./types.js";
