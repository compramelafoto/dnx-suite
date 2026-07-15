/**
 * Self-check canal público (Etapa 08C + 09A).
 * Ejecutar: pnpm --filter fotorank exec tsx app/lib/public-api/v1/channel.selfcheck.ts
 */
import assert from "node:assert/strict";
import {
  distributionChannelWhereForPublicFilter,
  eventMatchesPublicChannel,
  mapInternalDistributionChannelToPublic,
  parsePublicChannelQueryParam,
} from "./channel";

assert.equal(mapInternalDistributionChannelToPublic(null), null);
assert.equal(mapInternalDistributionChannelToPublic(undefined), null);
assert.equal(mapInternalDistributionChannelToPublic("CLICKATON"), "clickaton");
assert.equal(mapInternalDistributionChannelToPublic("FOTORANK"), "fotorank");

assert.equal(parsePublicChannelQueryParam(null), undefined);
assert.equal(parsePublicChannelQueryParam(""), undefined);
assert.equal(parsePublicChannelQueryParam("clickaton"), "clickaton");
assert.equal(parsePublicChannelQueryParam("FOTORANK"), "fotorank");
assert.equal(parsePublicChannelQueryParam("other"), null);

assert.deepEqual(distributionChannelWhereForPublicFilter("clickaton"), {
  distributionChannel: "CLICKATON",
  experienceType: "MARATHON",
});
assert.deepEqual(distributionChannelWhereForPublicFilter("fotorank"), {
  OR: [{ distributionChannel: "FOTORANK" }, { distributionChannel: null }],
});

assert.equal(eventMatchesPublicChannel("clickaton", "clickaton", "marathon"), true);
assert.equal(eventMatchesPublicChannel("clickaton", "clickaton", "contest"), false);
assert.equal(eventMatchesPublicChannel("fotorank", "clickaton"), false);
assert.equal(eventMatchesPublicChannel(null, "clickaton"), false);
assert.equal(eventMatchesPublicChannel(null, "fotorank"), true);
assert.equal(eventMatchesPublicChannel("fotorank", "fotorank"), true);
assert.equal(eventMatchesPublicChannel("clickaton", "fotorank"), false);

console.log("public-api/v1 channel.selfcheck: OK");
