import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryConversationStore } from "./in-memory-conversation-store.js";
import type { StoredConversation } from "./memory-models.js";

function makeConv(
  id: string,
  updatedAt: string,
  expiresAt: string,
): StoredConversation {
  return {
    id,
    status: "ACTIVE",
    activeFlow: "QUOTE_REQUEST",
    quoteRequestDraft: { serviceType: "WEDDING" },
    createdAt: updatedAt,
    updatedAt,
    expiresAt,
  };
}

describe("InMemoryConversationStore", () => {
  it("crea, recupera, actualiza y elimina", async () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const store = new InMemoryConversationStore({
      ttlMs: 60_000,
      now: () => now,
    });

    const created = makeConv("a", now.toISOString(), store.nextExpiresAt());
    await store.set(created);
    const got = await store.get("a");
    assert.equal(got?.id, "a");
    assert.equal(got?.quoteRequestDraft?.serviceType, "WEDDING");

    await store.update("a", (current) => {
      assert.ok(current);
      return {
        ...current,
        quoteRequestDraft: { serviceType: "WEDDING", city: "Córdoba" },
        updatedAt: now.toISOString(),
        expiresAt: store.nextExpiresAt(),
      };
    });
    assert.equal((await store.get("a"))?.quoteRequestDraft?.city, "Córdoba");

    await store.delete("a");
    assert.equal(await store.get("a"), undefined);
  });

  it("conversación expirada se trata como inexistente y se elimina", async () => {
    let now = new Date("2026-07-17T12:00:00.000Z");
    const store = new InMemoryConversationStore({
      ttlMs: 60_000,
      now: () => now,
    });
    await store.set(
      makeConv("exp", now.toISOString(), new Date(now.getTime() + 60_000).toISOString()),
    );
    now = new Date(now.getTime() + 120_000);
    assert.equal(await store.get("exp"), undefined);
    assert.equal(store.size(), 0);
  });

  it("respeta límite máximo eliminando la menos reciente", async () => {
    let now = new Date("2026-07-17T12:00:00.000Z");
    const store = new InMemoryConversationStore({
      ttlMs: 3_600_000,
      maxConversations: 2,
      now: () => now,
    });

    await store.set(
      makeConv("1", "2026-07-17T12:00:00.000Z", "2026-07-17T13:00:00.000Z"),
    );
    now = new Date("2026-07-17T12:01:00.000Z");
    await store.set(
      makeConv("2", "2026-07-17T12:01:00.000Z", "2026-07-17T13:01:00.000Z"),
    );
    now = new Date("2026-07-17T12:02:00.000Z");
    await store.set(
      makeConv("3", "2026-07-17T12:02:00.000Z", "2026-07-17T13:02:00.000Z"),
    );

    assert.equal(store.size(), 2);
    assert.equal(await store.get("1"), undefined);
    assert.ok(await store.get("2"));
    assert.ok(await store.get("3"));
  });

  it("no mezcla conversaciones distintas", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 60_000 });
    await store.set(
      makeConv("x", store.now().toISOString(), store.nextExpiresAt()),
    );
    await store.set({
      ...makeConv("y", store.now().toISOString(), store.nextExpiresAt()),
      quoteRequestDraft: { serviceType: "BIRTHDAY" },
    });
    assert.equal((await store.get("x"))?.quoteRequestDraft?.serviceType, "WEDDING");
    assert.equal((await store.get("y"))?.quoteRequestDraft?.serviceType, "BIRTHDAY");
  });
});
