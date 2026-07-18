import { simulateCopyProposal } from "../proposals/simulate-copy-proposal.js";
import {
  appendCalibrationHistory,
  loadCalibrationStore,
} from "../store.js";

const id = process.argv[2];
if (!id) {
  console.error("Usage: calibration:simulate <proposal-id>");
  process.exit(1);
}

const store = loadCalibrationStore();
const proposal = store.copyProposals.find((p) => p.id === id);
if (!proposal) {
  console.error("Proposal not found.");
  process.exit(1);
}

const result = await simulateCopyProposal(proposal);
appendCalibrationHistory("simulate", {
  proposalId: id,
  status: result.status,
  averageScoreBefore: result.averageScoreBefore,
  averageScoreAfter: result.averageScoreAfter,
});
console.log(JSON.stringify(result, null, 2));
process.exit(result.status === "REGRESSIONS_DETECTED" ? 2 : 0);
