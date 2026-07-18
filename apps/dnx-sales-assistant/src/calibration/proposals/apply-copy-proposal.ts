import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CopyCalibrationProposal } from "../domain/calibration-item.js";
import { simulateCopyProposal } from "./simulate-copy-proposal.js";

const CATALOG_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../conversation/style/dani-v1/dani-copy-catalog.ts",
);

export type ApplyResult =
  | { ok: true; dryRun: boolean; message: string; simulationStatus: string }
  | { ok: false; error: string; simulationStatus?: string };

/**
 * Dry-run por defecto. Con confirm=true aplica EDIT al catálogo TypeScript.
 * DISABLE / ADD_VARIANT no se aplican automáticamente (requieren revisión manual).
 */
export async function applyCopyProposal(
  proposal: CopyCalibrationProposal,
  options: { confirm?: boolean } = {},
): Promise<ApplyResult> {
  if (proposal.status !== "APPROVED") {
    return { ok: false, error: "PROPOSAL_NOT_APPROVED" };
  }

  const simulation = await simulateCopyProposal(proposal);
  if (simulation.status === "INVALID_PROPOSAL") {
    return {
      ok: false,
      error: "INVALID_PROPOSAL",
      simulationStatus: simulation.status,
    };
  }
  if (simulation.status === "REGRESSIONS_DETECTED") {
    return {
      ok: false,
      error: "REGRESSIONS_BLOCKED",
      simulationStatus: simulation.status,
    };
  }
  if (simulation.passedAfter < simulation.totalScenarios) {
    return {
      ok: false,
      error: "SCENARIOS_FAILED",
      simulationStatus: simulation.status,
    };
  }

  if (!options.confirm) {
    return {
      ok: true,
      dryRun: true,
      message: `Dry-run OK (${simulation.status}). Re-run with --confirm to apply.`,
      simulationStatus: simulation.status,
    };
  }

  if (proposal.action !== "EDIT" || !proposal.proposedText) {
    return {
      ok: false,
      error: "ONLY_EDIT_SUPPORTED_FOR_AUTO_APPLY",
      simulationStatus: simulation.status,
    };
  }

  const source = readFileSync(CATALOG_PATH, "utf8");
  const idLiteral = `"${proposal.copyId}"`;
  const idIndex = source.indexOf(idLiteral);
  if (idIndex < 0) {
    return { ok: false, error: "COPY_ID_NOT_FOUND_IN_CATALOG" };
  }

  const textKey = 'text: "';
  const textStart = source.indexOf(textKey, idIndex);
  if (textStart < 0 || textStart - idIndex > 400) {
    return { ok: false, error: "COPY_TEXT_NOT_LOCATED" };
  }
  const valueStart = textStart + textKey.length;
  const valueEnd = source.indexOf('"', valueStart);
  if (valueEnd < 0) {
    return { ok: false, error: "COPY_TEXT_NOT_LOCATED" };
  }

  const escaped = proposal.proposedText
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  const next =
    source.slice(0, valueStart) + escaped + source.slice(valueEnd);
  writeFileSync(CATALOG_PATH, next, "utf8");

  return {
    ok: true,
    dryRun: false,
    message: `Applied EDIT to ${proposal.copyId} in dani-copy-catalog.ts`,
    simulationStatus: simulation.status,
  };
}
