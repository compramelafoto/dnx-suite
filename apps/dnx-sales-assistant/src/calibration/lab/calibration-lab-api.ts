import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getCopyById } from "../../conversation/style/dani-v1/dani-copy-catalog.js";
import type { HumanPricingExplanationReview } from "../../pricing-review/domain/pricing-review-models.js";
import type { CalibrationCode } from "../domain/calibration-codes.js";
import { isCalibrationCode } from "../domain/calibration-codes.js";
import type {
  ConversationCalibrationItem,
  CopyCalibrationProposal,
  GoldenCaseProposal,
  GoldenConversationCase,
  StyleRuleCalibrationProposal,
} from "../domain/calibration-item.js";
import { generateCalibrationCandidates } from "../golden-cases/generate-candidates.js";
import { groupCalibrationItems } from "../grouping/group-calibration-items.js";
import { importLabExport } from "../import/import-lab-export.js";
import { normalizeCalibrationCode } from "../normalization/normalize-calibration-code.js";
import { CALIBRATION_EXPORTS_DIR } from "../paths.js";
import { applyCopyProposal } from "../proposals/apply-copy-proposal.js";
import { simulateCopyProposal } from "../proposals/simulate-copy-proposal.js";
import { buildQualitySummary } from "../reporting/build-quality-summary.js";
import { sanitizeCalibrationExport } from "../serialization/sanitize-calibration-export.js";
import {
  appendCalibrationHistory,
  loadCalibrationStore,
  saveCalibrationStore,
} from "../store.js";

export class CalibrationLabApi {
  getInbox(filters: Record<string, string | undefined> = {}) {
    const store = loadCalibrationStore();
    let items = [...store.items];
    if (filters.verdict) items = items.filter((i) => i.verdict === filters.verdict);
    if (filters.intent) items = items.filter((i) => i.detectedIntent === filters.intent);
    if (filters.askedField) items = items.filter((i) => i.askedField === filters.askedField);
    if (filters.copyId) {
      items = items.filter((i) => i.appliedCopyIds.includes(filters.copyId!));
    }
    if (filters.code) {
      items = items.filter((i) => i.calibrationCode === filters.code);
    }
    if (filters.scenario === "free") {
      items = items.filter((i) => !i.scenarioId);
    } else if (filters.scenario) {
      items = items.filter((i) => i.scenarioId === filters.scenario);
    }
    if (filters.visualNiche) {
      items = items.filter(
        (i) => i.visualReferenceIntent?.niche === filters.visualNiche,
      );
    }
    if (filters.styleVersion) {
      items = items.filter((i) => i.styleVersion === filters.styleVersion);
    }
    if (filters.minScore) {
      const min = Number(filters.minScore);
      items = items.filter((i) => (i.styleScore ?? 0) >= min);
    }
    return {
      items,
      visualItems: store.visualItems,
      quality: buildQualitySummary(store),
      groups: groupCalibrationItems(store.items),
      copyProposals: store.copyProposals,
      goldenCases: store.goldenCases,
      pendingGoldenProposals: store.pendingGoldenProposals,
      ruleProposals: store.ruleProposals,
    };
  }

  setItemCode(itemId: string, code: string) {
    if (!isCalibrationCode(code)) throw new Error("INVALID_CODE");
    const store = loadCalibrationStore();
    const item = store.items.find((i) => i.id === itemId);
    if (!item) throw new Error("ITEM_NOT_FOUND");
    item.calibrationCode = code as CalibrationCode;
    item.calibrationCodeSource = "MANUAL";
    saveCalibrationStore(store);
    return item;
  }

  importFromPath(filePath: string, redact?: boolean) {
    const store = loadCalibrationStore();
    const result = importLabExport(filePath, store, { redact });
    if (!result.ok) throw new Error(result.error);
    saveCalibrationStore(result.store);
    appendCalibrationHistory("import-lab", {
      sessionId: result.sessionId,
      itemsAdded: result.itemsAdded,
    });
    return result;
  }

  createCopyProposal(input: {
    copyId: string;
    action: CopyCalibrationProposal["action"];
    proposedText?: string;
    reason: string;
    evidenceItemIds: string[];
  }) {
    const store = loadCalibrationStore();
    const entry = getCopyById(input.copyId);
    const proposal: CopyCalibrationProposal = {
      id: `prop-${randomUUID().slice(0, 8)}`,
      copyId: input.copyId,
      currentText: entry?.text ?? "",
      proposedText: input.proposedText,
      action: input.action,
      reason: input.reason,
      evidenceItemIds: input.evidenceItemIds,
      affectedFields: entry?.field ? [entry.field] : [],
      affectedIntents: [],
      risks: ["Simular antes de aplicar.", "Dry-run por defecto."],
      status: "DRAFT",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.copyProposals.push(proposal);
    saveCalibrationStore(store);
    return proposal;
  }

  approveCopyProposal(id: string) {
    const store = loadCalibrationStore();
    const p = store.copyProposals.find((x) => x.id === id);
    if (!p) throw new Error("PROPOSAL_NOT_FOUND");
    p.status = "APPROVED";
    p.updatedAt = new Date().toISOString();
    saveCalibrationStore(store);
    return p;
  }

  async simulateProposal(id: string) {
    const store = loadCalibrationStore();
    const p = store.copyProposals.find((x) => x.id === id);
    if (!p) throw new Error("PROPOSAL_NOT_FOUND");
    const result = await simulateCopyProposal(p);
    appendCalibrationHistory("simulate-lab", { proposalId: id, status: result.status });
    return result;
  }

  async applyProposal(id: string, confirm: boolean) {
    const store = loadCalibrationStore();
    const p = store.copyProposals.find((x) => x.id === id);
    if (!p) throw new Error("PROPOSAL_NOT_FOUND");
    return applyCopyProposal(p, { confirm });
  }

  proposeGolden(itemId: string) {
    const store = loadCalibrationStore();
    const item = store.items.find((i) => i.id === itemId);
    if (!item) throw new Error("ITEM_NOT_FOUND");
    if (item.verdict !== "APPROVED") throw new Error("ONLY_APPROVED_CAN_BE_GOLDEN");

    const draft = {
      id: `golden-${randomUUID().slice(0, 8)}`,
      title: `Caso dorado turno ${item.turnNumber}`,
      description: item.note || `Desde sesión ${item.sourceSessionId}`,
      messages: [
        ...item.previousMessages
          .filter((m) => m.role === "USER")
          .map((m) => m.message),
        item.userMessage,
      ],
      expectedIntent: item.detectedIntent,
      expectedKnownFields: item.knownFields as GoldenConversationCase["expectedKnownFields"],
      forbiddenQuestionsAbout: item.knownFields as GoldenConversationCase["forbiddenQuestionsAbout"],
      expectedAskedField: item.askedField,
      expectedResponseCharacteristics: {
        maximumQuestions: 1,
        forbiddenPhrases: ["formulario", "completar los siguientes"],
        requiredConcepts: undefined,
        minimumStyleScore: 90,
      },
    };

    const proposal: GoldenCaseProposal = {
      id: `gp-${randomUUID().slice(0, 8)}`,
      calibrationItemId: item.id,
      status: "PROPOSED",
      proposedAt: new Date().toISOString(),
      draft,
    };
    store.pendingGoldenProposals.push(proposal);
    saveCalibrationStore(store);
    return proposal;
  }

  confirmGolden(proposalId: string) {
    const store = loadCalibrationStore();
    const proposal = store.pendingGoldenProposals.find((p) => p.id === proposalId);
    if (!proposal || proposal.status !== "PROPOSED") {
      throw new Error("GOLDEN_PROPOSAL_NOT_FOUND");
    }
    proposal.status = "CONFIRMED";
    proposal.confirmedAt = new Date().toISOString();
    const golden: GoldenConversationCase = {
      ...proposal.draft,
      status: "LOCAL_CONFIRMED",
      approvalMetadata: {
        approvedBy: "DANI",
        approvedAt: proposal.confirmedAt,
        sourceCalibrationItemId: proposal.calibrationItemId,
      },
    };
    store.goldenCases.push(golden);
    saveCalibrationStore(store);
    mkdirSync(path.join(CALIBRATION_EXPORTS_DIR, "..", "golden"), {
      recursive: true,
    });
    writeFileSync(
      path.join(
        path.dirname(CALIBRATION_EXPORTS_DIR),
        "golden",
        `${golden.id}.json`,
      ),
      `${JSON.stringify(golden, null, 2)}\n`,
      "utf8",
    );
    appendCalibrationHistory("confirm-golden", { goldenId: golden.id });
    return golden;
  }

  generateCandidates() {
    const store = loadCalibrationStore();
    return generateCalibrationCandidates(store);
  }

  createRuleProposal(input: Omit<StyleRuleCalibrationProposal, "id" | "createdAt" | "status"> & {
    status?: StyleRuleCalibrationProposal["status"];
  }) {
    const store = loadCalibrationStore();
    const proposal: StyleRuleCalibrationProposal = {
      id: `rule-${randomUUID().slice(0, 8)}`,
      status: input.status ?? "DRAFT",
      createdAt: new Date().toISOString(),
      ruleCode: input.ruleCode,
      action: input.action,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      evidenceItemIds: input.evidenceItemIds,
      reason: input.reason,
    };
    store.ruleProposals.push(proposal);
    saveCalibrationStore(store);
    return proposal;
  }

  exportReport() {
    const store = loadCalibrationStore();
    const payload = sanitizeCalibrationExport(store);
    mkdirSync(CALIBRATION_EXPORTS_DIR, { recursive: true });
    const name = `calibration-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(
      path.join(CALIBRATION_EXPORTS_DIR, name),
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8",
    );
    return { fileName: name, export: payload };
  }

  /** Importa reviews de la sesión lab actual (payload ya sanitizado). */
  ingestSessionExport(payload: unknown, redact?: boolean) {
    const store = loadCalibrationStore();
    mkdirSync(CALIBRATION_EXPORTS_DIR, { recursive: true });
    const tmp = path.join(
      CALIBRATION_EXPORTS_DIR,
      `ingest-${Date.now()}.json`,
    );
    writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    const result = importLabExport(tmp, store, { redact });
    if (!result.ok) throw new Error(result.error);
    saveCalibrationStore(result.store);
    return result;
  }

  recomputeCode(itemId: string) {
    const store = loadCalibrationStore();
    const item = store.items.find((i) => i.id === itemId);
    if (!item) throw new Error("ITEM_NOT_FOUND");
    const { code, source } = normalizeCalibrationCode({
      verdict: item.verdict,
      note: item.note,
      styleFlags: item.styleFlags,
      styleScore: item.styleScore,
    });
    item.calibrationCode = code;
    item.calibrationCodeSource = source;
    saveCalibrationStore(store);
    return item;
  }

  /**
   * Integra revisión humana de explicación de presupuesto.
   * No modifica automáticamente el copy ni las fórmulas.
   */
  ingestPricingExplanationReview(entry: HumanPricingExplanationReview) {
    const store = loadCalibrationStore();
    const code =
      entry.code && isCalibrationCode(entry.code)
        ? entry.code
        : ("PRICING_EXPLANATION_OTHER" as CalibrationCode);
    const item: ConversationCalibrationItem = {
      id: `pricing-exp-${randomUUID().slice(0, 8)}`,
      sourceSessionId: entry.sessionId,
      turnNumber: 0,
      userMessage: "[pricing-review]",
      assistantMessage: `Explicación ${entry.explanationVersion}`,
      previousMessages: [],
      verdict: entry.verdict,
      note: entry.note,
      styleVersion: entry.explanationVersion,
      appliedCopyIds: [],
      knownFields: [],
      missingFields: [],
      styleFlags: [],
      calibrationCode: code,
      calibrationCodeSource: entry.code ? "MANUAL" : "AUTO",
      createdAt: entry.createdAt,
      importedAt: new Date().toISOString(),
    };
    store.items.push(item);
    saveCalibrationStore(store);
    appendCalibrationHistory("pricing-explanation-review", {
      sessionId: entry.sessionId,
      verdict: entry.verdict,
      code,
    });
    return item;
  }
}
