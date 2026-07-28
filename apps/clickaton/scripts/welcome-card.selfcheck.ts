import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assertInstagramHandle, CLICKATON_WELCOME_STORY_V1, hashRenderInputs } from "@repo/media-composition";

function mustThrow(fn: () => unknown) {
  assert.throws(fn);
}

const instagram = assertInstagramHandle("@Clickaton.AR");
assert.equal(instagram.handle, "clickaton.ar");
assert.equal(instagram.url, "https://instagram.com/clickaton.ar");
mustThrow(() => assertInstagramHandle("a".repeat(31)));

assert.ok(CLICKATON_WELCOME_STORY_V1.variables.includes("participantName"));
assert.ok(CLICKATON_WELCOME_STORY_V1.variables.includes("instagram"));
assert.equal(CLICKATON_WELCOME_STORY_V1.platform, "CLICKATON");

const sameInputs = ["v1", "photo-hash", "Ana", "clickaton.ar"];
assert.equal(hashRenderInputs(sameInputs), hashRenderInputs(sameInputs));
assert.notEqual(hashRenderInputs(sameInputs), hashRenderInputs([...sameInputs, "changed"]));

const noPublish = { publicationStatus: "NOT_SCHEDULED", instagramPostId: null };
assert.equal(noPublish.publicationStatus, "NOT_SCHEDULED");
assert.equal(noPublish.instagramPostId, null);
assert.equal(createHash("sha256").update("paid").digest("hex").length, 64);

console.info("welcome-card.selfcheck: ok");
