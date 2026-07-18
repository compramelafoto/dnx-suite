import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CalibrationCandidate,
  CalibrationStore,
  GoldenConversationCase,
} from "../domain/calibration-item.js";
import { CALIBRATION_CANDIDATES_DIR } from "../paths.js";

const GOLDEN_SCENARIOS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../evaluation/scenarios/golden",
);

export type PromoteResult =
  | { ok: true; dryRun: boolean; message: string; scenarioPath?: string }
  | { ok: false; error: string };

function loadCandidate(candidateId: string): CalibrationCandidate | null {
  const file = path.join(CALIBRATION_CANDIDATES_DIR, `${candidateId}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as CalibrationCandidate;
}

export function promoteGoldenCandidate(
  store: CalibrationStore,
  candidateId: string,
  options: { confirm?: boolean } = {},
): PromoteResult {
  const candidate = loadCandidate(candidateId);
  if (!candidate) return { ok: false, error: "CANDIDATE_NOT_FOUND" };
  if (candidate.kind !== "golden-case") {
    return { ok: false, error: "NOT_A_GOLDEN_CANDIDATE" };
  }

  const golden = store.goldenCases.find((g) =>
    candidate.relatedItemIds.includes(g.approvalMetadata.sourceCalibrationItemId) ||
    candidate.id.includes(g.id.slice(0, 12)),
  ) ?? store.goldenCases.find((g) => g.status === "LOCAL_CONFIRMED");

  if (!golden || golden.status !== "LOCAL_CONFIRMED") {
    return { ok: false, error: "GOLDEN_NOT_CONFIRMED_BY_DANI" };
  }

  const scenario = goldenToScenario(golden);
  const preview = JSON.stringify(scenario, null, 2);

  if (!options.confirm) {
    return {
      ok: true,
      dryRun: true,
      message: `Dry-run promote.\n${preview.slice(0, 1200)}\n\nRe-run with --confirm to write versioned golden scenario.`,
    };
  }

  mkdirSync(GOLDEN_SCENARIOS_DIR, { recursive: true });
  const scenarioPath = path.join(GOLDEN_SCENARIOS_DIR, `${scenario.id}.json`);
  writeFileSync(scenarioPath, `${preview}\n`, "utf8");
  golden.status = "PROMOTED";

  return {
    ok: true,
    dryRun: false,
    message: `Promoted golden scenario to ${path.basename(scenarioPath)}`,
    scenarioPath: path.basename(scenarioPath),
  };
}

function goldenToScenario(golden: GoldenConversationCase) {
  return {
    id: `golden-${golden.id.replace(/^golden-/, "").slice(0, 40)}`,
    description: golden.description || golden.title,
    messages: golden.messages,
    expectations: {
      expectedIntent: golden.expectedIntent,
      expectedKnownFields: golden.expectedKnownFields,
      forbiddenQuestionsAbout: golden.forbiddenQuestionsAbout,
      maximumAssistantQuestionsPerTurn:
        golden.expectedResponseCharacteristics.maximumQuestions,
      minimumDaniStyleScore:
        golden.expectedResponseCharacteristics.minimumStyleScore,
      forbidFormAndTechnicalLanguage: true,
      // No fijar assistantMessage exacto salvo que exista copy fijo aprobado
      ...(golden.approvedAssistantResponse
        ? {
            requiredConcepts:
              golden.expectedResponseCharacteristics.requiredConcepts,
          }
        : {
            requiredConcepts:
              golden.expectedResponseCharacteristics.requiredConcepts,
          }),
    },
    approvalMetadata: golden.approvalMetadata,
    policy:
      "Los casos dorados deben proteger el comportamiento y la intención, no congelar innecesariamente cada palabra.",
  };
}
