import type { CalibrationStore } from "../domain/calibration-item.js";
import { groupCalibrationItems } from "../grouping/group-calibration-items.js";

export function buildQualitySummary(store: CalibrationStore) {
  const items = store.items;
  const total = items.length;
  const approved = items.filter((i) => i.verdict === "APPROVED").length;
  const needs = items.filter((i) => i.verdict === "NEEDS_ADJUSTMENT").length;
  const incorrect = items.filter((i) => i.verdict === "INCORRECT").length;
  const scores = items
    .map((i) => i.styleScore)
    .filter((s): s is number => typeof s === "number");
  const avgScore =
    scores.length === 0
      ? 0
      : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const highScoreRejected = items.filter(
    (i) => i.calibrationCode === "CALIBRATION_HIGH_SCORE_HUMAN_REJECTED",
  ).length;
  const lowScoreApproved = items.filter(
    (i) => i.calibrationCode === "CALIBRATION_LOW_SCORE_HUMAN_APPROVED",
  ).length;

  const groups = groupCalibrationItems(items);
  const topProblems = groups.byCode
    .filter((g) => g.key !== "CALIBRATION_OTHER" || g.incorrect + g.needsAdjustment > 0)
    .sort((a, b) => b.needsAdjustment + b.incorrect - (a.needsAdjustment + a.incorrect))
    .slice(0, 8);

  const lowestCopyApproval = groups.byCopyId
    .filter((g) => g.key !== "(none)" && g.total >= 1)
    .map((g) => ({
      copyId: g.key,
      approvalRate: g.total === 0 ? 0 : Math.round((g.approved / g.total) * 100),
      total: g.total,
    }))
    .sort((a, b) => a.approvalRate - b.approvalRate)
    .slice(0, 8);

  return {
    disclaimer:
      "El score automático y la aprobación humana miden aspectos distintos.",
    totalReviewed: total,
    percentApproved: total === 0 ? 0 : Math.round((approved / total) * 100),
    percentNeedsAdjustment: total === 0 ? 0 : Math.round((needs / total) * 100),
    percentIncorrect: total === 0 ? 0 : Math.round((incorrect / total) * 100),
    averageAutomaticScore: avgScore,
    highScoreHumanRejected: highScoreRejected,
    lowScoreHumanApproved: lowScoreApproved,
    topProblems,
    lowestCopyApproval,
    topFields: groups.byAskedField
      .filter((g) => g.key !== "(none)")
      .sort((a, b) => b.needsAdjustment + b.incorrect - (a.needsAdjustment + a.incorrect))
      .slice(0, 8),
    topIntents: groups.byIntent
      .filter((g) => g.key !== "(none)")
      .sort((a, b) => b.needsAdjustment + b.incorrect - (a.needsAdjustment + a.incorrect))
      .slice(0, 8),
    goldenCases: store.goldenCases.length,
    pendingCopyProposals: store.copyProposals.filter((p) => p.status === "DRAFT" || p.status === "APPROVED").length,
    appliedCopyProposals: store.copyProposals.filter((p) => p.status === "APPROVED").length,
    visualReviews: store.visualItems.length,
    pendingGoldenProposals: store.pendingGoldenProposals.filter(
      (p) => p.status === "PROPOSED",
    ).length,
  };
}
