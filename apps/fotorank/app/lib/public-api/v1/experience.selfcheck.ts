/**
 * Self-check experience type (Etapa 09A).
 * Ejecutar: pnpm --filter fotorank exec tsx app/lib/public-api/v1/experience.selfcheck.ts
 */
import assert from "node:assert/strict";
import {
  isIncoherentExperienceChannelCombo,
  isOfficialClickatonMarathon,
  mapInternalExperienceTypeToPublic,
} from "./experience";

assert.equal(mapInternalExperienceTypeToPublic("CONTEST"), "contest");
assert.equal(mapInternalExperienceTypeToPublic("MARATHON"), "marathon");
assert.equal(mapInternalExperienceTypeToPublic(null), "contest");
assert.equal(mapInternalExperienceTypeToPublic(undefined), "contest");

assert.equal(
  isOfficialClickatonMarathon({
    experienceType: "MARATHON",
    distributionChannel: "CLICKATON",
  }),
  true,
);
assert.equal(
  isOfficialClickatonMarathon({
    experienceType: "marathon",
    distributionChannel: "clickaton",
  }),
  true,
);
assert.equal(
  isOfficialClickatonMarathon({
    experienceType: "CONTEST",
    distributionChannel: "CLICKATON",
  }),
  false,
);
assert.equal(
  isOfficialClickatonMarathon({
    experienceType: "MARATHON",
    distributionChannel: "FOTORANK",
  }),
  false,
);
assert.equal(
  isOfficialClickatonMarathon({
    experienceType: "MARATHON",
    distributionChannel: null,
  }),
  false,
);

assert.equal(
  isIncoherentExperienceChannelCombo({
    experienceType: "CONTEST",
    distributionChannel: "CLICKATON",
  }),
  true,
);
assert.equal(
  isIncoherentExperienceChannelCombo({
    experienceType: "MARATHON",
    distributionChannel: "CLICKATON",
  }),
  false,
);
assert.equal(
  isIncoherentExperienceChannelCombo({
    experienceType: "CONTEST",
    distributionChannel: null,
  }),
  false,
);

console.log("public-api/v1 experience.selfcheck: OK");
