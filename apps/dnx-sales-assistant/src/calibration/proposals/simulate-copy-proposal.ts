import { runWithCopyOverridesAsync } from "../../conversation/style/dani-v1/dani-copy-catalog.js";
import { getCopyById } from "../../conversation/style/dani-v1/dani-copy-catalog.js";
import { runConversationScenario } from "../../evaluation/conversation-runner/run-conversation-scenario.js";
import { CONVERSATION_SCENARIOS } from "../../evaluation/scenarios/catalog.js";
import type { CopyCalibrationProposal } from "../domain/calibration-item.js";

export type SimulationStatus =
  | "SAFE_TO_REVIEW"
  | "REGRESSIONS_DETECTED"
  | "INVALID_PROPOSAL"
  | "NO_EFFECT";

export type SimulationResult = {
  status: SimulationStatus;
  proposalId: string;
  copyId: string;
  currentText: string;
  proposedText?: string;
  averageScoreBefore: number;
  averageScoreAfter: number;
  passedBefore: number;
  passedAfter: number;
  totalScenarios: number;
  regressions: Array<{ scenarioId: string; before: number; after: number }>;
  improved: Array<{ scenarioId: string; before: number; after: number }>;
  flagsRemoved: string[];
  flagsIntroduced: string[];
  catalogMutated: false;
};

async function runAll() {
  const results = [];
  for (const scenario of CONVERSATION_SCENARIOS) {
    results.push(await runConversationScenario(scenario));
  }
  return results;
}

export async function simulateCopyProposal(
  proposal: CopyCalibrationProposal,
): Promise<SimulationResult> {
  const entry = getCopyById(proposal.copyId);
  if (!entry && proposal.action !== "ADD_VARIANT") {
    return {
      status: "INVALID_PROPOSAL",
      proposalId: proposal.id,
      copyId: proposal.copyId,
      currentText: proposal.currentText,
      proposedText: proposal.proposedText,
      averageScoreBefore: 0,
      averageScoreAfter: 0,
      passedBefore: 0,
      passedAfter: 0,
      totalScenarios: CONVERSATION_SCENARIOS.length,
      regressions: [],
      improved: [],
      flagsRemoved: [],
      flagsIntroduced: [],
      catalogMutated: false,
    };
  }

  if (proposal.action === "KEEP" || proposal.action === "REVIEW_CONTEXT") {
    const baseline = await runAll();
    const avg =
      baseline.reduce((a, r) => a + r.daniStyle.score, 0) / baseline.length;
    return {
      status: "NO_EFFECT",
      proposalId: proposal.id,
      copyId: proposal.copyId,
      currentText: proposal.currentText,
      proposedText: proposal.proposedText,
      averageScoreBefore: Math.round(avg),
      averageScoreAfter: Math.round(avg),
      passedBefore: baseline.filter((r) => r.passed).length,
      passedAfter: baseline.filter((r) => r.passed).length,
      totalScenarios: baseline.length,
      regressions: [],
      improved: [],
      flagsRemoved: [],
      flagsIntroduced: [],
      catalogMutated: false,
    };
  }

  const before = await runAll();
  const overrides =
    proposal.action === "EDIT" && proposal.proposedText
      ? { textOverrides: { [proposal.copyId]: proposal.proposedText } }
      : proposal.action === "DISABLE"
        ? { disabledIds: [proposal.copyId] }
        : proposal.action === "ADD_VARIANT" && proposal.proposedText
          ? { textOverrides: { [proposal.copyId]: proposal.proposedText } }
          : null;

  if (!overrides) {
    return {
      status: "INVALID_PROPOSAL",
      proposalId: proposal.id,
      copyId: proposal.copyId,
      currentText: proposal.currentText,
      proposedText: proposal.proposedText,
      averageScoreBefore: 0,
      averageScoreAfter: 0,
      passedBefore: 0,
      passedAfter: 0,
      totalScenarios: CONVERSATION_SCENARIOS.length,
      regressions: [],
      improved: [],
      flagsRemoved: [],
      flagsIntroduced: [],
      catalogMutated: false,
    };
  }

  const after = await runWithCopyOverridesAsync(overrides, () => runAll());

  const avg = (rs: typeof before) =>
    Math.round(rs.reduce((a, r) => a + r.daniStyle.score, 0) / rs.length);

  const regressions: SimulationResult["regressions"] = [];
  const improved: SimulationResult["improved"] = [];
  const flagsBefore = new Set<string>();
  const flagsAfter = new Set<string>();

  for (let i = 0; i < before.length; i += 1) {
    const b = before[i]!;
    const a = after[i]!;
    for (const f of b.daniStyle.flags) flagsBefore.add(f.code);
    for (const f of a.daniStyle.flags) flagsAfter.add(f.code);
    if (a.daniStyle.score + 5 < b.daniStyle.score || (b.passed && !a.passed)) {
      regressions.push({
        scenarioId: b.scenario.id,
        before: b.daniStyle.score,
        after: a.daniStyle.score,
      });
    } else if (a.daniStyle.score > b.daniStyle.score + 5 || (!b.passed && a.passed)) {
      improved.push({
        scenarioId: b.scenario.id,
        before: b.daniStyle.score,
        after: a.daniStyle.score,
      });
    }
  }

  const severe = regressions.some((r) => r.after <= r.before - 15);
  const status: SimulationStatus =
    severe || after.some((r) => !r.passed)
      ? "REGRESSIONS_DETECTED"
      : "SAFE_TO_REVIEW";

  return {
    status,
    proposalId: proposal.id,
    copyId: proposal.copyId,
    currentText: proposal.currentText,
    proposedText: proposal.proposedText,
    averageScoreBefore: avg(before),
    averageScoreAfter: avg(after),
    passedBefore: before.filter((r) => r.passed).length,
    passedAfter: after.filter((r) => r.passed).length,
    totalScenarios: before.length,
    regressions,
    improved,
    flagsRemoved: [...flagsBefore].filter((f) => !flagsAfter.has(f)),
    flagsIntroduced: [...flagsAfter].filter((f) => !flagsBefore.has(f)),
    catalogMutated: false,
  };
}
