import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type {
  CalibrationCandidate,
  CalibrationStore,
} from "../domain/calibration-item.js";
import { CALIBRATION_CANDIDATES_DIR } from "../paths.js";
import { groupCalibrationItems } from "../grouping/group-calibration-items.js";

export function generateCalibrationCandidates(
  store: CalibrationStore,
): CalibrationCandidate[] {
  const candidates: CalibrationCandidate[] = [];
  const now = new Date().toISOString();
  const groups = groupCalibrationItems(store.items);

  for (const g of groups.byCopyId) {
    if (g.key === "(none)" || g.total < 2) continue;
    if (g.needsAdjustment + g.incorrect === 0) continue;
    const approvalRate = g.approved / g.total;
    if (approvalRate >= 0.7) continue;
    const id = `cand-${createHash("sha256").update(`copy:${g.key}`).digest("hex").slice(0, 12)}`;
    candidates.push({
      id,
      kind: approvalRate < 0.3 ? "copy-disable" : "copy-adjustment",
      cause: `Copy ${g.key} con baja aprobación (${Math.round(approvalRate * 100)}%). Predomina ${g.predominantCode}.`,
      evidence: g.notes.slice(0, 3),
      relatedItemIds: g.exampleItemIds,
      likelyAffectedFiles: [
        "src/conversation/style/dani-v1/dani-copy-catalog.ts",
      ],
      suggestedChange:
        "Revisar el texto del copy o agregar variante. No eliminar por una sola observación.",
      risks: [
        "Cambiar copy puede alterar determinismo de selección.",
        "No fijar frase exacta salvo aprobación explícita.",
      ],
      recommendedTests: [
        "conversation:evaluate:all",
        "calibration:simulate <proposal-id>",
      ],
      createdAt: now,
    });
  }

  for (const golden of store.goldenCases.filter((g) => g.status === "LOCAL_CONFIRMED")) {
    const id = `cand-golden-${golden.id.slice(0, 12)}`;
    candidates.push({
      id,
      kind: "golden-case",
      cause: `Caso dorado confirmado: ${golden.title}`,
      evidence: [golden.description],
      relatedItemIds: [golden.approvalMetadata.sourceCalibrationItemId],
      likelyAffectedFiles: [
        "src/evaluation/scenarios/catalog.ts",
        "src/evaluation/fixtures/ (si aplica)",
      ],
      suggestedChange:
        "Promover con calibration:promote-golden — expectations estructurales, no frase exacta salvo necesidad.",
      risks: ["Tests frágiles si se fija el texto completo."],
      recommendedTests: ["conversation:evaluate:all", "nuevo escenario offline"],
      createdAt: now,
    });
  }

  for (const v of store.visualItems.filter((x) => x.verdict !== "USEFUL")) {
    const id = `cand-visual-${createHash("sha256").update(v.id).digest("hex").slice(0, 12)}`;
    candidates.push({
      id,
      kind: "visual-niche-review",
      cause: `Revisión visual ${v.verdict} para ${v.referenceId} (${v.niche})`,
      evidence: v.note ? [v.note] : [],
      relatedItemIds: [v.id],
      likelyAffectedFiles: [
        ".local/visual-references/catalog.json",
      ],
      suggestedChange:
        "Revisar nicho/derechos/calidad manualmente. No modificar catálogo automáticamente.",
      risks: ["No alterar derechos sin verificación humana."],
      recommendedTests: ["visual-references:validate"],
      createdAt: now,
    });
  }

  mkdirSync(CALIBRATION_CANDIDATES_DIR, { recursive: true });
  for (const c of candidates) {
    writeFileSync(
      path.join(CALIBRATION_CANDIDATES_DIR, `${c.id}.json`),
      `${JSON.stringify(c, null, 2)}\n`,
      "utf8",
    );
  }
  return candidates;
}
