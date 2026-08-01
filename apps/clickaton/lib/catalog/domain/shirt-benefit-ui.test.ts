import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  presentShirtBenefitMessage,
  resolveShirtBenefitUiStatus,
} from "./first-n-benefit";

describe("resolveShirtBenefitUiStatus", () => {
  it("marks available when backend says benefit is open", () => {
    assert.equal(
      resolveShirtBenefitUiStatus({
        includesPhysicalMerch: true,
        shirtBenefitAvailable: true,
        shirtBenefitEnded: false,
      }),
      "available",
    );
  });

  it("marks ended when cupo/deadline closed", () => {
    assert.equal(
      resolveShirtBenefitUiStatus({
        includesPhysicalMerch: true,
        shirtBenefitAvailable: false,
        shirtBenefitEnded: true,
      }),
      "ended",
    );
  });

  it("hides message when phase has no merch", () => {
    assert.equal(
      resolveShirtBenefitUiStatus({
        includesPhysicalMerch: false,
        shirtBenefitAvailable: false,
        shirtBenefitEnded: false,
      }),
      "not_applicable",
    );
  });
});

describe("presentShirtBenefitMessage", () => {
  it("states correspondence clearly", () => {
    const available = presentShirtBenefitMessage("available") ?? "";
    const ended = presentShirtBenefitMessage("ended") ?? "";
    assert.match(available, /Te corresponde/i);
    assert.match(ended, /No te corresponde/i);
    assert.equal(presentShirtBenefitMessage("not_applicable"), null);
  });
});
