import { buildQualitySummary } from "../reporting/build-quality-summary.js";
import { groupCalibrationItems } from "../grouping/group-calibration-items.js";
import { loadCalibrationStore } from "../store.js";

const store = loadCalibrationStore();
const summary = buildQualitySummary(store);
const groups = groupCalibrationItems(store.items);

console.log("DNX calibration report");
console.log(summary.disclaimer);
console.log(JSON.stringify(summary, null, 2));
console.log("\nTop copy groups:");
for (const g of groups.byCopyId.slice(0, 10)) {
  console.log(
    `Grupo: ${g.key} · Revisiones: ${g.total} · Aprobadas: ${g.approved} · Ajuste: ${g.needsAdjustment} · Incorrectas: ${g.incorrect} · Predomina: ${g.predominantCode}`,
  );
}
