import { promoteGoldenCandidate } from "../golden-cases/promote-golden.js";
import {
  appendCalibrationHistory,
  loadCalibrationStore,
  saveCalibrationStore,
} from "../store.js";

const id = process.argv[2];
const confirm = process.argv.includes("--confirm");
if (!id) {
  console.error("Usage: calibration:promote-golden <candidate-id> [--confirm]");
  process.exit(1);
}

const store = loadCalibrationStore();
const result = promoteGoldenCandidate(store, id, { confirm });
appendCalibrationHistory("promote-golden", { candidateId: id, confirm, result });
if (!result.ok) {
  console.error(`Promote failed: ${result.error}`);
  process.exit(1);
}
console.log(result.message);
if (!result.dryRun) {
  saveCalibrationStore(store);
}
process.exit(0);
