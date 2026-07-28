import assert from "node:assert/strict";
import {
  createInMemorySocialPublisherStore,
  createInstagramPublishProvider,
  createSocialPublisherEngine,
} from "@repo/social-publisher";

const store = createInMemorySocialPublisherStore();
store.accounts.set("instagram-1", {
  id: "instagram-1", platform: "INSTAGRAM", ownerUserId: 1, externalAccountId: "ig-user",
  businessId: null, username: "clickaton", displayName: "Clickatón", scopes: [], status: "ACTIVE",
  expiresAt: null, lastValidatedAt: null, createdAt: new Date(), updatedAt: new Date(),
});
store.tokens.set("instagram-1", "test-token");
const engine = createSocialPublisherEngine(store, new Map([["INSTAGRAM", createInstagramPublishProvider()]]));
const request = engine.createRequest({
  application: "CLICKATON", entityType: "WELCOME_CARD", entityId: "welcome-1",
  caption: "Bienvenida", assets: [{ assetId: "asset-1", kind: "IMAGE", publicUrl: "https://cdn.example/welcome.png" }],
  target: { platform: "INSTAGRAM", socialAccountId: "instagram-1" },
  idempotencyKey: "clickaton:welcome-publish:registration-1",
});
assert.equal(request.status, "PENDING_APPROVAL");
assert.equal(engine.createRequest({
  application: "CLICKATON", entityType: "WELCOME_CARD", entityId: "welcome-1",
  caption: "Bienvenida", assets: [], target: { platform: "INSTAGRAM", socialAccountId: "instagram-1" },
  idempotencyKey: "clickaton:welcome-publish:registration-1",
}).id, request.id);
engine.approve(request.id, 1);
const completed = await engine.processOne(request.id);
assert.equal(completed.status, "PUBLISHED");
assert.equal(store.attempts[0]?.dryRun, true);
console.info("social-publisher.selfcheck: ok");
