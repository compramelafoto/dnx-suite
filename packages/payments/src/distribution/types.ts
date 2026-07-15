import type { DistributionRule } from "../contracts/entities.js";
import type { Money } from "../money/types.js";

export type RoundingPolicy =
  | "LARGEST_REMAINDER"
  | "PLATFORM_ABSORBS"
  | "FIRST_RECIPIENT_ABSORBS";

export type PercentageBase = "REMAINDER" | "GROSS";

export type OptionalRecipientPolicy =
  | "DROP_AND_REDISTRIBUTE"
  | "DROP_TO_PLATFORM"
  | "FAIL";

export interface CalculateDistributionInput {
  total: Money;
  rules: DistributionRule[];
  rounding: RoundingPolicy;
  percentageBase?: PercentageBase;
  optionalPolicy?: OptionalRecipientPolicy;
  /** Recipients currently eligible (e.g. ACTIVE consent). */
  eligibleRecipientIds: ReadonlySet<string> | readonly string[];
  /** Required when rounding is PLATFORM_ABSORBS or DROP_TO_PLATFORM. */
  platformRecipientId?: string;
}

export interface CalculatedDistributionEntry {
  recipientId: string;
  role: DistributionRule["role"];
  amount: Money;
  ruleKind: DistributionRule["kind"];
  priority: number;
}

export interface CalculatedDistribution {
  total: Money;
  entries: CalculatedDistributionEntry[];
  rounding: RoundingPolicy;
  droppedRecipientIds: string[];
}
