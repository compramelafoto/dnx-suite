import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildParticipantChecklist,
  presentArtworkStatus,
  presentRegistrationStatus,
} from "./participant-status";

describe("participant-status", () => {
  it("presents registration without raw enum jargon", () => {
    const s = presentRegistrationStatus("CONFIRMED");
    assert.equal(s.tone, "success");
    assert.match(s.label, /confirmada/i);
    assert.doesNotMatch(s.label, /CONFIRMED|pipeline|queue|asset/i);
  });

  it("shows upload closed without offering load action", () => {
    const s = presentArtworkStatus({
      hasEntry: false,
      uploadOpen: false,
    });
    assert.equal(s.nextAction, null);
    assert.match(s.label, /no habilitada|aún/i);
  });

  it("offers load when upload open and no entry", () => {
    const s = presentArtworkStatus({
      hasEntry: false,
      uploadOpen: true,
    });
    assert.equal(s.nextAction, "Cargar fotografía");
  });

  it("builds checklist with text states (not color-only)", () => {
    const items = buildParticipantChecklist({
      registered: true,
      registrationStatus: "CONFIRMED",
      hasEntry: false,
      uploadOpen: false,
    });
    assert.equal(items.find((i) => i.id === "registration")?.state, "done");
    assert.equal(items.find((i) => i.id === "photo")?.state, "upcoming");
    assert.ok(items.every((i) => i.title && i.description && i.mark));
  });

  it("flags attention when entry needs review", () => {
    const items = buildParticipantChecklist({
      registered: true,
      registrationStatus: "CONFIRMED",
      hasEntry: true,
      entryStatus: "NEEDS_REVIEW",
      uploadOpen: true,
    });
    assert.equal(items.find((i) => i.id === "photo")?.state, "attention");
  });
});
