import assert from "node:assert/strict";
import { RULES_PLACEHOLDER_MARKER } from "../registration/rules-hash";
import { assertProductionOpenAllowed, evaluatePlaceholderGate } from "./placeholder-gate";

const blocked = evaluatePlaceholderGate({
  publishedContent: `${RULES_PLACEHOLDER_MARKER}\ntexto`,
  draftExists: false,
});
assert.equal(blocked.status, "BLOCKED_PLACEHOLDER");
assert.throws(() => assertProductionOpenAllowed(blocked));

const none = evaluatePlaceholderGate({ publishedContent: null, draftExists: true });
assert.equal(none.status, "BLOCKED_DRAFT_ONLY");

const ready = evaluatePlaceholderGate({
  publishedContent: "Bases oficiales Santa Fe en Foco — sin marcador placeholder.",
  draftExists: false,
  confirmedRules: {
    imageUsageTerms: true,
    privacy: true,
    minAge: true,
    participationConditions: true,
    technicalRules: true,
    dates: true,
    prizes: true,
    disqualification: true,
    publicationAuthorization: true,
  },
});
assert.equal(ready.status, "READY");
assertProductionOpenAllowed(ready);

console.log("placeholder-gate.selfcheck.ts OK");
