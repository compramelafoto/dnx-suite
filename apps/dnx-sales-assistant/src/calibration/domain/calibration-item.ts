import type { CalibrationCode } from "./calibration-codes.js";

export type CalibrationVerdict = "APPROVED" | "NEEDS_ADJUSTMENT" | "INCORRECT";

export type ConversationCalibrationItem = {
  id: string;
  sourceSessionId: string;
  turnNumber: number;
  userMessage: string;
  assistantMessage: string;
  previousMessages: Array<{ role: "USER" | "ASSISTANT"; message: string }>;
  verdict: CalibrationVerdict;
  note?: string;
  styleVersion: string;
  responseType?: string;
  askedField?: string;
  appliedCopyIds: string[];
  detectedIntent?: string;
  knownFields: string[];
  missingFields: string[];
  styleScore?: number;
  styleFlags: string[];
  visualReferenceIntent?: {
    requested: boolean;
    niche?: string;
  };
  calibrationCode: CalibrationCode;
  calibrationCodeSource: "AUTO" | "MANUAL";
  scenarioId?: string;
  createdAt: string;
  importedAt: string;
};

export type VisualCalibrationItem = {
  id: string;
  sourceSessionId: string;
  referenceId: string;
  niche: string;
  verdict: string;
  note?: string;
  createdAt: string;
  importedAt: string;
};

export type CalibrationStore = {
  version: 1;
  updatedAt: string;
  items: ConversationCalibrationItem[];
  visualItems: VisualCalibrationItem[];
  importedSessionIds: string[];
  goldenCases: GoldenConversationCase[];
  pendingGoldenProposals: GoldenCaseProposal[];
  copyProposals: CopyCalibrationProposal[];
  ruleProposals: StyleRuleCalibrationProposal[];
};

export type GoldenConversationCase = {
  id: string;
  title: string;
  description: string;
  messages: string[];
  expectedIntent?: string;
  expectedKnownFields?: string[];
  forbiddenQuestionsAbout?: string[];
  expectedAskedField?: string;
  expectedResponseCharacteristics: {
    maximumQuestions: number;
    forbiddenPhrases: string[];
    requiredConcepts?: string[];
    minimumStyleScore: number;
  };
  approvedAssistantResponse?: string;
  approvalMetadata: {
    approvedBy: "DANI";
    approvedAt: string;
    sourceCalibrationItemId: string;
  };
  status: "LOCAL_CONFIRMED" | "PROMOTED";
};

export type GoldenCaseProposal = {
  id: string;
  calibrationItemId: string;
  status: "PROPOSED" | "CONFIRMED" | "REJECTED";
  proposedAt: string;
  confirmedAt?: string;
  draft: Omit<GoldenConversationCase, "status" | "approvalMetadata"> & {
    approvalMetadata?: GoldenConversationCase["approvalMetadata"];
  };
};

export type CopyCalibrationProposal = {
  id: string;
  copyId: string;
  currentText: string;
  proposedText?: string;
  action: "KEEP" | "EDIT" | "DISABLE" | "ADD_VARIANT" | "REVIEW_CONTEXT";
  reason: string;
  evidenceItemIds: string[];
  affectedFields: string[];
  affectedIntents: string[];
  risks: string[];
  status: "DRAFT" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
};

export type StyleRuleCalibrationProposal = {
  id: string;
  ruleCode: string;
  action:
    | "CHANGE_WEIGHT"
    | "ADD_EXCEPTION"
    | "ADD_RULE"
    | "DISABLE_RULE"
    | "REVIEW_THRESHOLD";
  currentValue?: unknown;
  proposedValue?: unknown;
  evidenceItemIds: string[];
  reason: string;
  status: "DRAFT" | "APPROVED" | "REJECTED";
  createdAt: string;
};

export type CalibrationCandidate = {
  id: string;
  kind:
    | "golden-case"
    | "new-scenario"
    | "expectation-update"
    | "copy-adjustment"
    | "copy-disable"
    | "question-order-review"
    | "extractor-review"
    | "visual-niche-review";
  cause: string;
  evidence: string[];
  relatedItemIds: string[];
  likelyAffectedFiles: string[];
  suggestedChange: string;
  risks: string[];
  recommendedTests: string[];
  createdAt: string;
};

export const EMPTY_CALIBRATION_STORE: CalibrationStore = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  items: [],
  visualItems: [],
  importedSessionIds: [],
  goldenCases: [],
  pendingGoldenProposals: [],
  copyProposals: [],
  ruleProposals: [],
};
