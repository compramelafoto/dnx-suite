import { containsSensitiveLeak } from "../../review-lab/export/sanitize-export.js";
import type { CalibrationStore } from "../domain/calibration-item.js";
import { buildQualitySummary } from "../reporting/build-quality-summary.js";
import { groupCalibrationItems } from "../grouping/group-calibration-items.js";

export function sanitizeCalibrationExport(store: CalibrationStore): Record<string, unknown> {
  const payload = {
    kind: "dnx-sales-assistant-calibration-export",
    version: 1,
    disclaimer:
      "Las revisiones humanas no modifican automáticamente el comportamiento del asistente.",
    updatedAt: store.updatedAt,
    quality: buildQualitySummary(store),
    groups: groupCalibrationItems(store.items),
    items: store.items.map((i) => ({
      id: i.id,
      sourceSessionId: i.sourceSessionId,
      turnNumber: i.turnNumber,
      verdict: i.verdict,
      note: i.note,
      calibrationCode: i.calibrationCode,
      appliedCopyIds: i.appliedCopyIds,
      askedField: i.askedField,
      detectedIntent: i.detectedIntent,
      styleScore: i.styleScore,
      styleFlags: i.styleFlags,
      visualReferenceIntent: i.visualReferenceIntent,
      scenarioId: i.scenarioId,
      // mensajes incluidos (ya redactados al importar si se pidió)
      userMessage: i.userMessage,
      assistantMessage: i.assistantMessage,
    })),
    visualItems: store.visualItems.map((v) => ({
      id: v.id,
      referenceId: v.referenceId,
      niche: v.niche,
      verdict: v.verdict,
      note: v.note,
    })),
    goldenCases: store.goldenCases.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      messages: g.messages,
      status: g.status,
      expectedResponseCharacteristics: g.expectedResponseCharacteristics,
      approvalMetadata: g.approvalMetadata,
    })),
    copyProposals: store.copyProposals.map((p) => ({
      id: p.id,
      copyId: p.copyId,
      action: p.action,
      status: p.status,
      reason: p.reason,
      evidenceItemIds: p.evidenceItemIds,
    })),
    ruleProposals: store.ruleProposals.map((p) => ({
      id: p.id,
      ruleCode: p.ruleCode,
      action: p.action,
      status: p.status,
      reason: p.reason,
    })),
  };

  const json = JSON.stringify(payload);
  if (containsSensitiveLeak(json)) {
    throw new Error("CALIBRATION_EXPORT_LEAK");
  }
  if (/\/Users\/|\/home\/|[A-Za-z]:\\/.test(json)) {
    throw new Error("CALIBRATION_EXPORT_ABSOLUTE_PATH");
  }
  return payload;
}
