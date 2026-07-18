import { loadCalibrationStore } from "../store.js";
import { isCalibrationCode } from "../domain/calibration-codes.js";
import { containsSensitiveLeak } from "../../review-lab/export/sanitize-export.js";

const store = loadCalibrationStore();
let issues = 0;

for (const item of store.items) {
  if (!isCalibrationCode(item.calibrationCode)) {
    console.error(`Invalid code on ${item.id}`);
    issues += 1;
  }
  if (containsSensitiveLeak(JSON.stringify(item))) {
    console.error(`Sensitive leak on ${item.id}`);
    issues += 1;
  }
}

for (const p of store.copyProposals) {
  if (p.status === "APPROVED" && p.action === "EDIT" && !p.proposedText) {
    console.error(`Approved EDIT without proposedText: ${p.id}`);
    issues += 1;
  }
}

if (issues > 0) {
  console.log(`Result: INVALID (${issues} issues)`);
  process.exit(1);
}
console.log(
  `Result: OK · items=${store.items.length} proposals=${store.copyProposals.length} golden=${store.goldenCases.length}`,
);
process.exit(0);
