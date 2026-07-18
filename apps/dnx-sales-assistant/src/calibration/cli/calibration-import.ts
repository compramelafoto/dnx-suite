import { importLabExport } from "../import/import-lab-export.js";
import {
  appendCalibrationHistory,
  loadCalibrationStore,
  saveCalibrationStore,
} from "../store.js";

const file = process.argv[2];
const redact = process.argv.includes("--redact");
if (!file) {
  console.error("Usage: calibration:import <file> [--redact]");
  process.exit(1);
}

const store = loadCalibrationStore();
const result = importLabExport(file, store, { redact });
if (!result.ok) {
  console.error(`Import failed: ${result.error}`);
  process.exit(1);
}
saveCalibrationStore(result.store);
appendCalibrationHistory("import", {
  sessionId: result.sessionId,
  itemsAdded: result.itemsAdded,
  visualAdded: result.visualAdded,
  redact,
});
console.log(
  `Imported session ${result.sessionId}: ${result.itemsAdded} items, ${result.visualAdded} visual reviews.`,
);
