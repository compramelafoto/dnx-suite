import assert from "node:assert/strict";
import { registrationNeedsRulesReacceptance } from "./rules-reacceptance";

assert.equal(
  registrationNeedsRulesReacceptance({
    acceptedRulesVersionId: "v1",
    currentPublishedRulesVersionId: null,
  }),
  false,
);

assert.equal(
  registrationNeedsRulesReacceptance({
    acceptedRulesVersionId: "v2",
    currentPublishedRulesVersionId: "v2",
  }),
  false,
);

assert.equal(
  registrationNeedsRulesReacceptance({
    acceptedRulesVersionId: "v1",
    currentPublishedRulesVersionId: "v2",
  }),
  true,
);

console.log("rules-reacceptance.selfcheck: OK");
