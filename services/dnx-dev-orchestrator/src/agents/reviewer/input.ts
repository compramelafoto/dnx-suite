import type { BudgetDecision } from "../../budget/types.js";
import type { CursorRunRecord, Stage, Task } from "../../state/types.js";
import { summarizeCursorRun } from "./cursor-summary.js";
import { detectCursorSafetyViolations, safetyPolicySummaryLines } from "./safety-gate.js";
import { classifyProposedValidationCommand } from "./validation-catalog.js";
import type { ReviewerInput, ValidationEvidenceItem } from "./types.js";

function extractEnvelopeHint(prompt: string): string {
  const lines = prompt.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "(empty prompt)";
  const first = lines[0] ?? "";
  const last = lines[lines.length - 1] ?? "";
  return first === last ? first : `${first} … ${last}`;
}

function buildClaimedValidationEvidence(resultText: string, proposed: string[]): ValidationEvidenceItem[] {
  const items: ValidationEvidenceItem[] = [];
  for (const command of proposed) {
    const classified = classifyProposedValidationCommand(command);
    const claimed =
      /pass|ok|success|typecheck|test|lint/i.test(resultText) && classified.looksFamiliar;
    items.push({
      label: command,
      evidenceType: "CLAIMED_BY_CURSOR",
      detail: claimed
        ? "Cursor resultText appears to claim related validation; not verified by orchestrator."
        : classified.note,
      passed: claimed ? null : null,
    });
  }
  return items;
}

export function buildReviewerInput(options: {
  task: Task;
  stage: Stage;
  cursorRun: CursorRunRecord;
  budget: BudgetDecision;
  maxResultChars: number;
  maxFilesChangedWarning: number;
}): ReviewerInput {
  const { task, stage, cursorRun, budget, maxResultChars, maxFilesChangedWarning } = options;
  const cursorRunSummary = summarizeCursorRun(cursorRun, maxResultChars);
  const findings = detectCursorSafetyViolations(cursorRun);
  const filesChanged = cursorRun.filesChanged ?? [];
  const emptyDiffWarning =
    filesChanged.length === 0 &&
    Boolean(stage.plan) &&
    /implement|edit|write|create|fix|add/i.test(stage.plan?.objective ?? stage.title);
  const filesChangedWarning = filesChanged.length > maxFilesChangedWarning;

  const completionCriteria = stage.plan?.completionCriteria ?? [];
  const validationCommandsProposed = stage.plan?.validationCommands ?? [];

  const gitObserved: ValidationEvidenceItem[] = [
    {
      label: "git filesChanged",
      evidenceType: "GIT_OBSERVED",
      detail: `count=${filesChanged.length}`,
      passed: filesChanged.length > 0 ? true : null,
    },
  ];

  const previous =
    task.stages
      .filter((s) => s.stageId !== stage.stageId && s.stageNumber < stage.stageNumber)
      .sort((a, b) => b.stageNumber - a.stageNumber)[0] ?? null;

  return {
    taskSummary: {
      taskId: task.taskId,
      project: task.project,
      objective: task.objective,
      status: task.status,
      currentStage: task.currentStage,
      iteration: task.iteration,
      maxIterations: task.maxIterations,
    },
    stagePlan: stage.plan ?? null,
    stagePromptMetadata: {
      stageId: stage.stageId,
      stageNumber: stage.stageNumber,
      title: stage.title,
      status: stage.status,
      promptEnvelopeHint: extractEnvelopeHint(stage.prompt),
      completionCriteria,
      validationCommandsProposed,
    },
    cursorRunSummary,
    gitEvidence: {
      filesChanged,
      gitDiffStat: cursorRunSummary.gitDiffStat,
      gitStatusBefore: cursorRunSummary.gitStatusBefore,
      gitStatusAfter: cursorRunSummary.gitStatusAfter,
      emptyDiffWarning,
      filesChangedWarning,
      filesChangedWarningThreshold: maxFilesChangedWarning,
    },
    validationEvidence: [
      ...gitObserved,
      ...buildClaimedValidationEvidence(cursorRunSummary.resultText, validationCommandsProposed),
    ],
    safetyContext: {
      policyLines: safetyPolicySummaryLines(),
      programmaticFindings: findings.map((f) => `${f.code}: ${f.message}`),
      codeSafetyOverridesModel: true,
    },
    budgetStatus: budget,
    previousRelevantStageSummary: previous
      ? { stageId: previous.stageId, title: previous.title, status: previous.status }
      : null,
  };
}

/** Compact JSON for token control / tests. */
export function compactReviewerInput(input: ReviewerInput): ReviewerInput {
  return {
    ...input,
    cursorRunSummary: {
      ...input.cursorRunSummary,
      resultText:
        input.cursorRunSummary.resultText.length > 8_000
          ? `${input.cursorRunSummary.resultText.slice(0, 8_000)}\n...[compacted]`
          : input.cursorRunSummary.resultText,
    },
    stagePlan: input.stagePlan
      ? {
          ...input.stagePlan,
          prompt:
            input.stagePlan.prompt.length > 2_000
              ? `${input.stagePlan.prompt.slice(0, 2_000)}\n...[prompt compacted for review]`
              : input.stagePlan.prompt,
        }
      : null,
  };
}
