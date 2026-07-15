import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryIdempotencyStore } from "../idempotency/store.js";

describe("InMemoryIdempotencyStore", () => {
  it("stores and retrieves results by key", () => {
    const store = new InMemoryIdempotencyStore();
    store.set("key-1", { providerOrderId: "ord-1", status: "OPEN" });
    const record = store.get<{ providerOrderId: string; status: string }>("key-1");
    assert.ok(record);
    assert.equal(record.result.providerOrderId, "ord-1");
    assert.ok(store.has("key-1"));
  });

  it("deletes and clears records", () => {
    const store = new InMemoryIdempotencyStore();
    store.set("a", 1);
    assert.equal(store.delete("a"), true);
    assert.equal(store.has("a"), false);
    store.set("b", 2);
    store.clear();
    assert.equal(store.has("b"), false);
  });
});
