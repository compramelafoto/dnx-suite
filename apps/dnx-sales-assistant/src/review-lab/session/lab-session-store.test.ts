import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LabSessionStore } from "./lab-session-store.js";

describe("LabSessionStore", () => {
  it("crea, recupera y respeta límite de sesiones", () => {
    const now = { value: new Date("2026-07-18T00:00:00.000Z") };
    const store = new LabSessionStore({
      maxSessions: 2,
      ttlMs: 60_000,
      now: () => now.value,
    });
    const a = store.create();
    const b = store.create();
    assert.equal(store.size(), 2);
    store.create();
    assert.equal(store.size(), 2);
    assert.equal(store.get(a.id), undefined);
    assert.ok(store.get(b.id));
  });

  it("expira sesiones", () => {
    const now = { value: new Date("2026-07-18T00:00:00.000Z") };
    const store = new LabSessionStore({
      ttlMs: 1000,
      now: () => now.value,
    });
    const s = store.create();
    now.value = new Date("2026-07-18T00:00:02.000Z");
    assert.equal(store.get(s.id), undefined);
  });
});
