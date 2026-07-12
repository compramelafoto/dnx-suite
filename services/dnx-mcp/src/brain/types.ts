/**
 * Tipos centrales del DNX Brain.
 * El Brain recibe información estructurada de Orchestrators — sin HTTP ni providers.
 */

export type BrainVerdict = "approve" | "caution" | "reject";

export type BrainOperation =
  "release.prepare" | "release.validate" | "release.execute" | "release.rollback";

export type SignalSeverity = "low" | "medium" | "high" | "critical";

export type SignalType = "risk" | "metric" | "checklist" | "issue" | "policy" | "state" | "health";

export interface BrainContext {
  operation: BrainOperation;
  platformId: string;
  platformName: string;
  phase?: string | undefined;
  dryRun?: boolean | undefined;
  orchestrator?: string | undefined;
}

export interface BrainSignal {
  source: string;
  type: SignalType;
  key: string;
  message: string;
  severity?: SignalSeverity | undefined;
  value?: unknown;
}

export interface BrainInput {
  context: BrainContext;
  signals: BrainSignal[];
  metadata?: Record<string, unknown> | undefined;
}

export interface EvaluatedRisk {
  id: string;
  level: SignalSeverity;
  source: string;
  message: string;
  weight: number;
  blocking: boolean;
}

export interface Inconsistency {
  id: string;
  severity: SignalSeverity;
  description: string;
  signals: string[];
}

export interface BrainAction {
  id: string;
  priority: "high" | "medium" | "low";
  action: string;
  rationale: string;
}

export interface BrainDecision {
  verdict: BrainVerdict;
  score: number;
  confidence: number;
  reasoning: string[];
  recommendation: string;
  nextActions: BrainAction[];
  risks: EvaluatedRisk[];
  inconsistencies: Inconsistency[];
  rejected: boolean;
  /** true cuando la operación debe detenerse (reject o rejected). */
  shouldBlock: boolean;
  context: BrainContext;
  evaluatedAt: string;
}

export interface BrainEvaluateOptions {
  recordHistory?: boolean | undefined;
}

export interface DecisionRecord {
  id: string;
  input: BrainInput;
  decision: BrainDecision;
  recordedAt: string;
}

export interface BrainStats {
  totalDecisions: number;
  approvals: number;
  rejections: number;
  cautions: number;
  averageScore: number;
  averageConfidence: number;
}
