import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createConversationId } from "./create-conversation-id.js";

describe("createConversationId", () => {
  it("mismo remitente → mismo ID", () => {
    assert.equal(createConversationId("5493411234567"), createConversationId("5493411234567"));
    assert.equal(createConversationId("+54 9 341 123-4567"), createConversationId("5493411234567"));
  });

  it("remitentes distintos → IDs distintos", () => {
    assert.notEqual(createConversationId("5493411111111"), createConversationId("5493412222222"));
  });

  it("ID no contiene el teléfono", () => {
    const id = createConversationId("5493411234567");
    assert.equal(id.includes("549341"), false);
    assert.equal(/^[a-f0-9]{64}$/.test(id), true);
  });
});
