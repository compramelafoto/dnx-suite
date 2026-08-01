import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  __resetParticipantCardRateLimitForTests,
  checkParticipantCardRateLimit,
} from "../participant-card-rate-limit";

describe("checkParticipantCardRateLimit", () => {
  it("allows 5 participant requests per minute", () => {
    __resetParticipantCardRateLimitForTests();
    const now = 1_700_000_000_000;
    for (let i = 0; i < 5; i += 1) {
      const r = checkParticipantCardRateLimit({
        actorKind: "participant",
        userId: 1,
        now: now + i,
      });
      assert.equal(r.allowed, true);
    }
    const blocked = checkParticipantCardRateLimit({
      actorKind: "participant",
      userId: 1,
      now: now + 5,
    });
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.ok(blocked.retryAfterMs > 0);
    }
  });

  it("allows 10 admin requests per minute", () => {
    __resetParticipantCardRateLimitForTests();
    const now = 1_700_000_000_000;
    for (let i = 0; i < 10; i += 1) {
      const r = checkParticipantCardRateLimit({
        actorKind: "admin",
        userId: 2,
        now: now + i,
      });
      assert.equal(r.allowed, true);
    }
    const blocked = checkParticipantCardRateLimit({
      actorKind: "admin",
      userId: 2,
      now: now + 10,
    });
    assert.equal(blocked.allowed, false);
  });
});
