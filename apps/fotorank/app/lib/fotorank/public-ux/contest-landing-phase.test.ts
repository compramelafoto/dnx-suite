import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  finalCtaCopy,
  getLandingPhase,
  PHASE_LABEL,
  phaseCta,
} from "./contest-landing-phase";

describe("contest-landing-phase", () => {
  const base = {
    status: "ACTIVE",
    startAt: new Date("2026-01-01T00:00:00Z"),
    submissionDeadline: new Date("2026-12-31T23:59:59Z"),
    judgingStartAt: new Date("2027-01-15T00:00:00Z"),
    resultsAt: new Date("2027-02-01T00:00:00Z"),
  };

  it("marks open when within registration window", () => {
    const phase = getLandingPhase({
      ...base,
      now: new Date("2026-06-01T12:00:00Z").getTime(),
    });
    assert.equal(phase, "open");
    assert.equal(phaseCta(phase).enabled, true);
    assert.equal(phaseCta(phase).primary, "Inscribirme");
  });

  it("does not enable CTA when closed", () => {
    const phase = getLandingPhase({
      ...base,
      now: new Date("2027-01-05T12:00:00Z").getTime(),
    });
    assert.equal(phase, "closed");
    assert.equal(phaseCta(phase).enabled, false);
    assert.match(PHASE_LABEL[phase], /cerrad/i);
  });

  it("marks last-days within 7 days of deadline", () => {
    const phase = getLandingPhase({
      ...base,
      now: new Date("2026-12-28T12:00:00Z").getTime(),
    });
    assert.equal(phase, "last-days");
    assert.equal(phaseCta(phase).enabled, true);
  });

  it("final CTA copy never invites closed actions", () => {
    for (const phase of ["closed", "in-evaluation", "finalized", "coming-soon"] as const) {
      const cta = phaseCta(phase);
      assert.equal(cta.enabled, false);
      const copy = finalCtaCopy(phase);
      assert.ok(copy.title.length > 0);
      assert.ok(copy.action.length > 0);
    }
  });

  it("uses in-evaluation between judging and results", () => {
    const phase = getLandingPhase({
      ...base,
      now: new Date("2027-01-20T12:00:00Z").getTime(),
    });
    assert.equal(phase, "in-evaluation");
    assert.equal(phaseCta(phase).enabled, false);
  });
});
