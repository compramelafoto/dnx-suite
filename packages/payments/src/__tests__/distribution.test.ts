import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateDistribution, DistributionError } from "../distribution/index.js";
import { money, sumMoney } from "../money/index.js";
import { samplePhotoPurchaseRules } from "../testing/index.js";

describe("Distribution engine", () => {
  it("splits 100% with largest remainder summing to total", () => {
    const total = money("ARS", 100);
    const result = calculateDistribution({
      total,
      rules: [
        {
          recipientId: "a",
          role: "PLATFORM",
          kind: "PERCENTAGE",
          percentageBps: 3333,
          priority: 1,
        },
        {
          recipientId: "b",
          role: "PHOTOGRAPHER",
          kind: "PERCENTAGE",
          percentageBps: 3333,
          priority: 2,
        },
        {
          recipientId: "c",
          role: "ORGANIZER",
          kind: "PERCENTAGE",
          percentageBps: 3334,
          priority: 3,
        },
      ],
      rounding: "LARGEST_REMAINDER",
      eligibleRecipientIds: ["a", "b", "c"],
    });
    const sum = sumMoney(
      result.entries.map((e) => e.amount),
      "ARS",
    );
    assert.equal(sum.amountMinor, 100n);
  });

  it("applies fixed then percentage on remainder", () => {
    const total = money("ARS", 10_000);
    const result = calculateDistribution({
      total,
      rules: [
        {
          recipientId: "platform",
          role: "PLATFORM",
          kind: "FIXED",
          fixedAmount: money("ARS", 1500),
          priority: 1,
        },
        {
          recipientId: "photo",
          role: "PHOTOGRAPHER",
          kind: "PERCENTAGE",
          percentageBps: 8000,
          priority: 2,
        },
        {
          recipientId: "org",
          role: "ORGANIZER",
          kind: "PERCENTAGE",
          percentageBps: 2000,
          priority: 3,
        },
      ],
      rounding: "LARGEST_REMAINDER",
      percentageBase: "REMAINDER",
      eligibleRecipientIds: ["platform", "photo", "org"],
    });
    assert.equal(
      result.entries.find((e) => e.recipientId === "platform")?.amount.amountMinor,
      1500n,
    );
    assert.equal(
      sumMoney(
        result.entries.map((e) => e.amount),
        "ARS",
      ).amountMinor,
      10_000n,
    );
  });

  it("drops optional ineligible recipients", () => {
    const total = money("ARS", 10_000);
    const rules = samplePhotoPurchaseRules().map((r) =>
      r.recipientId === "organizer"
        ? r
        : r.recipientId === "platform"
          ? { ...r, percentageBps: 2000 }
          : { ...r, percentageBps: 8000 },
    );
    // Without organizer: platform 20% + photo 80%
    const withoutOrg = rules.filter((r) => r.recipientId !== "organizer");
    const result = calculateDistribution({
      total,
      rules: withoutOrg,
      rounding: "LARGEST_REMAINDER",
      eligibleRecipientIds: ["platform", "photographer"],
    });
    assert.equal(result.entries.length, 2);
  });

  it("fails when required recipient is ineligible", () => {
    assert.throws(
      () =>
        calculateDistribution({
          total: money("ARS", 1000),
          rules: samplePhotoPurchaseRules(),
          rounding: "LARGEST_REMAINDER",
          eligibleRecipientIds: ["platform", "organizer"],
        }),
      DistributionError,
    );
  });

  it("renormalizes percentages when optional recipient is dropped", () => {
    const result = calculateDistribution({
      total: money("ARS", 10_000),
      rules: samplePhotoPurchaseRules(),
      rounding: "LARGEST_REMAINDER",
      eligibleRecipientIds: ["platform", "photographer"],
      optionalPolicy: "DROP_AND_REDISTRIBUTE",
    });
    assert.deepEqual(result.droppedRecipientIds, ["organizer"]);
    assert.equal(result.entries.length, 2);
    assert.equal(
      sumMoney(
        result.entries.map((e) => e.amount),
        "ARS",
      ).amountMinor,
      10_000n,
    );
  });

  it("rejects percentages not summing to 100%", () => {
    assert.throws(
      () =>
        calculateDistribution({
          total: money("ARS", 1000),
          rules: [
            {
              recipientId: "a",
              role: "PLATFORM",
              kind: "PERCENTAGE",
              percentageBps: 5000,
              priority: 1,
            },
          ],
          rounding: "LARGEST_REMAINDER",
          eligibleRecipientIds: ["a"],
        }),
      DistributionError,
    );
  });
});
