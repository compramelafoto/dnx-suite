import { applyCopyProposal } from "../proposals/apply-copy-proposal.js";
import {
  appendCalibrationHistory,
  loadCalibrationStore,
  saveCalibrationStore,
} from "../store.js";

const id = process.argv[2];
const confirm = process.argv.includes("--confirm");
if (!id) {
  console.error("Usage: calibration:apply <proposal-id> [--confirm]");
  process.exit(1);
}

const store = loadCalibrationStore();
const proposal = store.copyProposals.find((p) => p.id === id);
if (!proposal) {
  console.error("Proposal not found.");
  process.exit(1);
}

const result = await applyCopyProposal(proposal, { confirm });
appendCalibrationHistory("apply", {
  proposalId: id,
  confirm,
  result,
});
if (!result.ok) {
  console.error(`Apply blocked: ${result.error}`);
  process.exit(1);
}
console.log(result.message);
if (!result.dryRun) {
  saveCalibrationStore(store);
}
process.exit(0);
