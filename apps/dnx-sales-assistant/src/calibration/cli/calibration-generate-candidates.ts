import { generateCalibrationCandidates } from "../golden-cases/generate-candidates.js";
import {
  appendCalibrationHistory,
  loadCalibrationStore,
} from "../store.js";

const store = loadCalibrationStore();
const candidates = generateCalibrationCandidates(store);
appendCalibrationHistory("generate-candidates", {
  count: candidates.length,
  ids: candidates.map((c) => c.id),
});
console.log(`Generated ${candidates.length} candidates in .local/calibration/candidates/`);
for (const c of candidates) {
  console.log(`- ${c.id} [${c.kind}] ${c.cause.slice(0, 100)}`);
}
