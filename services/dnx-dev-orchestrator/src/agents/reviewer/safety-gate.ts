import type { CursorRunRecord } from "../../state/types.js";
import type { ReviewDecision } from "./schema.js";

const VIOLATION_PATTERNS: Array<{ pattern: RegExp; code: string; message: string }> = [
  { pattern: /\bgit\s+push\b/i, code: "SAFETY_PUSH", message: "Evidence of git push" },
  { pattern: /\b--force\b|\bforce[- ]push\b/i, code: "SAFETY_FORCE_PUSH", message: "Evidence of force push" },
  { pattern: /\bgit\s+merge\b/i, code: "SAFETY_MERGE", message: "Evidence of git merge" },
  { pattern: /\bdeploy\b.*\bprod(uction)?\b|\bproduction\b.*\bdeploy\b/i, code: "SAFETY_DEPLOY_PROD", message: "Evidence of production deploy" },
  { pattern: /\breset\s+--hard\b/i, code: "SAFETY_RESET_HARD", message: "Evidence of git reset --hard" },
  {
    pattern: /\b(DROP\s+TABLE|TRUNCATE\s+TABLE|ALTER\s+USER)\b/i,
    code: "SAFETY_DB_DESTRUCTIVE",
    message: "Evidence of destructive DB operation",
  },
  {
    pattern: /\b(OPENAI_API_KEY|AWS_SECRET|PRIVATE_KEY|BEGIN\s+PRIVATE)\b/i,
    code: "SAFETY_SECRET_EXPOSURE",
    message: "Possible secret exposure in Cursor output",
  },
  {
    pattern: /\b(vercel\s+deploy|--prod|cloudflare\s+.*prod|mercado\s*pago.*prod)\b/i,
    code: "SAFETY_EXTERNAL_INFRA",
    message: "Evidence of external infra / production mutation",
  },
];

export type SafetyFinding = {
  code: string;
  message: string;
  source: "resultText" | "stderr" | "stdout" | "gitDiffStat" | "error";
};

export function detectCursorSafetyViolations(run: CursorRunRecord): SafetyFinding[] {
  const buckets: Array<{ source: SafetyFinding["source"]; text: string }> = [
    { source: "resultText", text: run.resultText ?? "" },
    { source: "stderr", text: run.stderr ?? "" },
    { source: "stdout", text: run.stdout ?? "" },
    { source: "gitDiffStat", text: run.gitDiffStat ?? "" },
    { source: "error", text: run.error ?? "" },
  ];

  const findings: SafetyFinding[] = [];
  for (const bucket of buckets) {
    if (!bucket.text) continue;
    for (const rule of VIOLATION_PATTERNS) {
      if (rule.pattern.test(bucket.text)) {
        findings.push({
          code: rule.code,
          message: `${rule.message} (${bucket.source})`,
          source: bucket.source,
        });
      }
    }
  }
  return findings;
}

/**
 * CODE SAFETY > REVIEWER OUTPUT.
 * Forces BLOCKED (or HUMAN_REQUIRED for secret exposure) when violations found.
 */
export function applySafetyOverride(
  decision: ReviewDecision,
  findings: SafetyFinding[],
): { decision: ReviewDecision; override: string | null } {
  if (findings.length === 0) {
    return { decision, override: null };
  }

  const secret = findings.some((f) => f.code === "SAFETY_SECRET_EXPOSURE");
  const forcedDecision = secret ? "HUMAN_REQUIRED" : "BLOCKED";
  const override = `CODE_SAFETY_OVERRIDE:${findings.map((f) => f.code).join(",")}`;

  return {
    override,
    decision: {
      ...decision,
      decision: forcedDecision,
      summary: `${forcedDecision}: ${findings.map((f) => f.message).join("; ")}`,
      evidence: [...decision.evidence, ...findings.map((f) => f.message)],
      missingEvidence: decision.missingEvidence,
      issues: [
        ...decision.issues,
        ...findings.map((f) => ({
          severity: "CRITICAL" as const,
          code: f.code,
          message: f.message,
          retryRecommended: false,
        })),
      ],
      retryRecommended: false,
      nextStageRecommendation: null,
      taskDisposition: secret ? "HUMAN_REQUIRED" : "BLOCKED",
    },
  };
}

export function safetyPolicySummaryLines(): string[] {
  return [
    "FAIL CLOSED",
    "CODE SAFETY > REVIEWER OUTPUT",
    "No auto push/merge/deploy/production",
    "exitCode=0 ≠ STAGE_COMPLETED",
    "OUTPUT_TRUNCATED reduces confidence",
    "CLAIMED_BY_CURSOR is weak evidence",
  ];
}
