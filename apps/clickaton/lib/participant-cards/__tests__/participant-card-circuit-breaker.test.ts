import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { ParticipantCardCircuitBreaker } from "../participant-card-circuit-breaker";

describe("ParticipantCardCircuitBreaker", () => {
  let now: number;
  let breaker: ParticipantCardCircuitBreaker;

  beforeEach(() => {
    now = 1_000_000;
    breaker = new ParticipantCardCircuitBreaker({
      failureThreshold: 3,
      halfOpenAfterMs: 30_000,
      now: () => now,
    });
  });

  it("starts CLOSED and allows attempts", () => {
    assert.equal(breaker.getState(), "CLOSED");
    assert.equal(breaker.canAttempt(), true);
  });

  it("opens after consecutive failures", () => {
    breaker.recordFailure();
    breaker.recordFailure();
    assert.equal(breaker.canAttempt(), true);
    breaker.recordFailure();
    assert.equal(breaker.getState(), "OPEN");
    assert.equal(breaker.canAttempt(), false);
  });

  it("transitions to HALF_OPEN after cooldown and closes on success", () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    assert.equal(breaker.getState(), "OPEN");

    now += 30_000;
    assert.equal(breaker.getState(), "HALF_OPEN");
    assert.equal(breaker.canAttempt(), true);

    breaker.recordSuccess();
    assert.equal(breaker.getState(), "CLOSED");
  });
});
