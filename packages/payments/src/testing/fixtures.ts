import type { DistributionRule } from "../contracts/entities.js";
import { money } from "../money/index.js";

/** Fixtures for domain tests — no network. */
export function samplePhotoPurchaseRules(): DistributionRule[] {
  return [
    {
      recipientId: "platform",
      role: "PLATFORM",
      kind: "PERCENTAGE",
      percentageBps: 1500,
      priority: 10,
    },
    {
      recipientId: "photographer",
      role: "PHOTOGRAPHER",
      kind: "PERCENTAGE",
      percentageBps: 7000,
      priority: 20,
    },
    {
      recipientId: "organizer",
      role: "ORGANIZER",
      kind: "PERCENTAGE",
      percentageBps: 1500,
      priority: 30,
      optional: true,
    },
  ];
}

export function ars(minor: number | bigint) {
  return money("ARS", minor);
}
