import type { ReviewDecision } from "./schema.js";
import type { ReviewerInput } from "./types.js";
import { emptyUsage } from "../planner/usage.js";

export type ReviewerMockScenario =
  | "success"
  | "retry"
  | "human-required"
  | "blocked"
  | "failed"
  | "next-stage";

export function resolveMockScenario(input: ReviewerInput, env: NodeJS.ProcessEnv = process.env): ReviewerMockScenario {
  const fromEnv = env.DNX_ORCH_REVIEWER_MOCK_SCENARIO?.trim().toLowerCase();
  if (
    fromEnv === "success" ||
    fromEnv === "retry" ||
    fromEnv === "human-required" ||
    fromEnv === "blocked" ||
    fromEnv === "failed" ||
    fromEnv === "next-stage"
  ) {
    return fromEnv;
  }

  const haystack = [
    input.stagePromptMetadata.title,
    input.taskSummary.objective,
    input.cursorRunSummary.resultText,
  ].join("\n");

  if (haystack.includes("__MOCK_REVIEW_RETRY__")) return "retry";
  if (haystack.includes("__MOCK_REVIEW_HUMAN__")) return "human-required";
  if (haystack.includes("__MOCK_REVIEW_BLOCKED__")) return "blocked";
  if (haystack.includes("__MOCK_REVIEW_FAILED__")) return "failed";
  if (haystack.includes("__MOCK_REVIEW_NEXT__")) return "next-stage";
  return "success";
}

export function createMockReviewDecision(
  input: ReviewerInput,
  scenario?: ReviewerMockScenario,
): ReviewDecision {
  const resolved = scenario ?? resolveMockScenario(input);

  switch (resolved) {
    case "retry":
      return {
        decision: "RETRY_STAGE",
        summary: "Mock reviewer: stage needs retry — insufficient validation evidence.",
        evidence: [
          `cursorRunId=${input.cursorRunSummary.cursorRunId}`,
          `exitCode=${String(input.cursorRunSummary.exitCode)}`,
        ],
        missingEvidence: ["Verified test/typecheck evidence"],
        issues: [
          {
            severity: "ERROR",
            code: "MISSING_VALIDATION",
            message: "Completion criteria not evidenced; retry recommended.",
            retryRecommended: true,
          },
        ],
        retryRecommended: true,
        nextStageRecommendation: null,
        taskDisposition: "CONTINUE",
      };
    case "human-required":
      return {
        decision: "HUMAN_REQUIRED",
        summary: "Mock reviewer: human approval required before continuing.",
        evidence: ["Risk or ambiguity detected in mock scenario"],
        missingEvidence: ["Explicit human decision"],
        issues: [
          {
            severity: "WARNING",
            code: "HUMAN_GATE",
            message: "Human must confirm scope / legal / production boundary.",
            retryRecommended: false,
          },
        ],
        retryRecommended: false,
        nextStageRecommendation: null,
        taskDisposition: "HUMAN_REQUIRED",
      };
    case "blocked":
      return {
        decision: "BLOCKED",
        summary: "Mock reviewer: blocked by safety/policy.",
        evidence: ["Mock blocked scenario"],
        missingEvidence: [],
        issues: [
          {
            severity: "CRITICAL",
            code: "SAFETY_BLOCK",
            message: "Unsafe path detected in mock scenario.",
            retryRecommended: false,
          },
        ],
        retryRecommended: false,
        nextStageRecommendation: null,
        taskDisposition: "BLOCKED",
      };
    case "failed":
      return {
        decision: "FAILED",
        summary: "Mock reviewer: stage failed.",
        evidence: [`exitCode=${String(input.cursorRunSummary.exitCode)}`],
        missingEvidence: [],
        issues: [
          {
            severity: "ERROR",
            code: "CURSOR_FAILED",
            message: "Cursor run did not achieve a reviewable successful outcome.",
            retryRecommended: true,
          },
        ],
        retryRecommended: true,
        nextStageRecommendation: null,
        taskDisposition: "CONTINUE",
      };
    case "next-stage":
      return {
        decision: "CREATE_NEXT_STAGE",
        summary: "Mock reviewer: stage completed; next intent recommended.",
        evidence: [
          `filesChanged=${input.cursorRunSummary.filesChangedCount}`,
          "Mock completion criteria satisfied",
        ],
        missingEvidence: [],
        issues: [],
        retryRecommended: false,
        nextStageRecommendation: {
          title: "VALIDAR Y CERRAR",
          objective: `Validar resultados de: ${input.taskSummary.objective}`,
          reason: "Stage current met objective; remaining validation/polish needed.",
          riskLevel: "LOW",
        },
        taskDisposition: "CONTINUE",
      };
    case "success":
    default:
      return {
        decision: "STAGE_COMPLETED",
        summary: "Mock reviewer: stage objective met with available evidence.",
        evidence: [
          `cursorStatus=${input.cursorRunSummary.status}`,
          `exitCode=${String(input.cursorRunSummary.exitCode)}`,
          `filesChanged=${input.cursorRunSummary.filesChangedCount}`,
          ...input.stagePromptMetadata.completionCriteria.map((c) => `criterion:${c}`),
        ],
        missingEvidence: [],
        issues: [],
        retryRecommended: false,
        nextStageRecommendation: null,
        taskDisposition: "CONTINUE",
      };
  }
}

export function mockReviewerUsage() {
  return emptyUsage();
}
