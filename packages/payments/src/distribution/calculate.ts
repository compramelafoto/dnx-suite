import type { DistributionRule } from "../contracts/entities.js";
import type { RecipientRole } from "../contracts/primitives.js";
import { MoneyError, money, sumMoney } from "../money/index.js";
import type { Money } from "../money/types.js";
import type {
  CalculateDistributionInput,
  CalculatedDistribution,
  CalculatedDistributionEntry,
  RoundingPolicy,
} from "./types.js";

export class DistributionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DistributionError";
  }
}

function toEligibleSet(
  eligible: CalculateDistributionInput["eligibleRecipientIds"],
): Set<string> {
  return eligible instanceof Set ? eligible : new Set(eligible);
}

function sortByPriority(rules: DistributionRule[]): DistributionRule[] {
  return [...rules].sort((a, b) => a.priority - b.priority || a.recipientId.localeCompare(b.recipientId));
}

function applyLargestRemainder(
  currency: Money["currency"],
  targetTotal: bigint,
  shares: Array<{
    recipientId: string;
    role: RecipientRole;
    ruleKind: DistributionRule["kind"];
    priority: number;
    floor: bigint;
    remainderWeight: bigint;
  }>,
): CalculatedDistributionEntry[] {
  let allocated = 0n;
  for (const s of shares) {
    allocated += s.floor;
  }
  let remainder = targetTotal - allocated;
  const ordered = [...shares].sort((a, b) => {
    if (a.remainderWeight !== b.remainderWeight) {
      return a.remainderWeight > b.remainderWeight ? -1 : 1;
    }
    return a.priority - b.priority || a.recipientId.localeCompare(b.recipientId);
  });
  const amounts = new Map<string, bigint>();
  for (const s of shares) {
    amounts.set(s.recipientId, s.floor);
  }
  for (const s of ordered) {
    if (remainder <= 0n) break;
    amounts.set(s.recipientId, (amounts.get(s.recipientId) ?? 0n) + 1n);
    remainder -= 1n;
  }
  if (remainder !== 0n) {
    throw new DistributionError(`rounding remainder not fully allocated: ${remainder}`);
  }
  return shares.map((s) => ({
    recipientId: s.recipientId,
    role: s.role,
    ruleKind: s.ruleKind,
    priority: s.priority,
    amount: money(currency, amounts.get(s.recipientId) ?? 0n),
  }));
}

function absorbRemainder(
  entries: CalculatedDistributionEntry[],
  total: Money,
  policy: RoundingPolicy,
  platformRecipientId: string | undefined,
): CalculatedDistributionEntry[] {
  const sum = sumMoney(
    entries.map((e) => e.amount),
    total.currency,
  );
  const delta = total.amountMinor - sum.amountMinor;
  if (delta === 0n) return entries;
  if (entries.length === 0) {
    throw new DistributionError("cannot absorb remainder into empty entries");
  }

  const clone = entries.map((e) => ({
    ...e,
    amount: money(e.amount.currency, e.amount.amountMinor),
  }));

  let idx = 0;
  if (policy === "PLATFORM_ABSORBS") {
    if (!platformRecipientId) {
      throw new DistributionError("platformRecipientId required for PLATFORM_ABSORBS");
    }
    const found = clone.findIndex((e) => e.recipientId === platformRecipientId);
    if (found < 0) {
      throw new DistributionError("platform recipient missing from entries");
    }
    idx = found;
  } else if (policy === "FIRST_RECIPIENT_ABSORBS") {
    idx = 0;
  } else {
    return clone;
  }

  const target = clone[idx];
  if (!target) {
    throw new DistributionError("absorb target missing");
  }
  target.amount = money(total.currency, target.amount.amountMinor + delta);
  return clone;
}

/**
 * Pure distribution engine — deterministic, no I/O, no provider coupling.
 */
export function calculateDistribution(input: CalculateDistributionInput): CalculatedDistribution {
  const { total, rounding } = input;
  if (total.amountMinor <= 0n) {
    throw new DistributionError("total must be positive");
  }

  const eligible = toEligibleSet(input.eligibleRecipientIds);
  const optionalPolicy = input.optionalPolicy ?? "DROP_AND_REDISTRIBUTE";
  const percentageBase = input.percentageBase ?? "REMAINDER";
  const dropped: string[] = [];

  const activeRules: DistributionRule[] = [];
  for (const rule of sortByPriority(input.rules)) {
    const ok = eligible.has(rule.recipientId);
    if (ok) {
      activeRules.push(rule);
      continue;
    }
    if (rule.optional) {
      if (optionalPolicy === "FAIL") {
        throw new DistributionError(`optional recipient not eligible: ${rule.recipientId}`);
      }
      dropped.push(rule.recipientId);
      continue;
    }
    throw new DistributionError(`required recipient not eligible: ${rule.recipientId}`);
  }

  if (activeRules.length === 0) {
    throw new DistributionError("no active distribution rules");
  }

  // Duplicate recipients
  const seen = new Set<string>();
  for (const r of activeRules) {
    if (seen.has(r.recipientId)) {
      throw new DistributionError(`duplicate recipient in rules: ${r.recipientId}`);
    }
    seen.add(r.recipientId);
  }

  const fixedRules = activeRules.filter((r) => r.kind === "FIXED");
  let pctRules = activeRules.filter((r) => r.kind === "PERCENTAGE");

  if (
    dropped.length > 0 &&
    optionalPolicy === "DROP_AND_REDISTRIBUTE" &&
    pctRules.length > 0
  ) {
    const bpsBefore = pctRules.reduce((acc, r) => acc + (r.percentageBps ?? 0), 0);
    if (bpsBefore <= 0) {
      throw new DistributionError("cannot redistribute percentages with zero bps base");
    }
    // Largest-remainder renormalization of bps to 10000
    const floors = pctRules.map((r) => {
      const bps = r.percentageBps ?? 0;
      const exact = (10_000 * bps) / bpsBefore;
      const floor = Math.floor(exact);
      return { rule: r, floor, frac: exact - floor };
    });
    let allocated = floors.reduce((a, f) => a + f.floor, 0);
    let rem = 10_000 - allocated;
    floors.sort((a, b) => b.frac - a.frac || a.rule.priority - b.rule.priority);
    const bpsMap = new Map<string, number>();
    for (const f of floors) bpsMap.set(f.rule.recipientId, f.floor);
    for (const f of floors) {
      if (rem <= 0) break;
      bpsMap.set(f.rule.recipientId, (bpsMap.get(f.rule.recipientId) ?? 0) + 1);
      rem -= 1;
    }
    pctRules = pctRules.map((r) => ({
      ...r,
      percentageBps: bpsMap.get(r.recipientId) ?? r.percentageBps,
    }));
  }

  if (optionalPolicy === "DROP_TO_PLATFORM" && dropped.length > 0) {
    if (!input.platformRecipientId) {
      throw new DistributionError("platformRecipientId required for DROP_TO_PLATFORM");
    }
    // Product should encode platform catch-all; for now require platform already in active rules
    if (!activeRules.some((r) => r.recipientId === input.platformRecipientId)) {
      throw new DistributionError("platform recipient must be present for DROP_TO_PLATFORM");
    }
  }

  let fixedSum = 0n;
  const fixedEntries: CalculatedDistributionEntry[] = [];
  for (const rule of fixedRules) {
    if (!rule.fixedAmount) {
      throw new DistributionError(`FIXED rule missing fixedAmount: ${rule.recipientId}`);
    }
    if (rule.fixedAmount.currency !== total.currency) {
      throw new MoneyError("fixed amount currency mismatch");
    }
    if (rule.fixedAmount.amountMinor < 0n) {
      throw new DistributionError("fixed amount cannot be negative");
    }
    fixedSum += rule.fixedAmount.amountMinor;
    fixedEntries.push({
      recipientId: rule.recipientId,
      role: rule.role,
      amount: rule.fixedAmount,
      ruleKind: "FIXED",
      priority: rule.priority,
    });
  }

  if (pctRules.length === 0) {
    if (fixedSum !== total.amountMinor) {
      throw new DistributionError(
        `fixed rules sum ${fixedSum} must equal total ${total.amountMinor}`,
      );
    }
    return { total, entries: fixedEntries, rounding, droppedRecipientIds: dropped };
  }

  let pctPool: bigint;
  if (percentageBase === "GROSS") {
    pctPool = total.amountMinor;
    // Fixed still allocated; percentages computed on gross then we must reconcile.
    // For GROSS+FIXED combo, require fixed+pct conceptually cover total via rounding on pct slice of gross,
    // then verify sum. Simpler rule: GROSS only allowed when there are no FIXED rules.
    if (fixedRules.length > 0) {
      throw new DistributionError("percentageBase GROSS cannot combine with FIXED rules");
    }
  } else {
    if (fixedSum > total.amountMinor) {
      throw new DistributionError("fixed rules exceed total");
    }
    pctPool = total.amountMinor - fixedSum;
  }

  let bpsSum = 0;
  for (const rule of pctRules) {
    if (rule.percentageBps === undefined) {
      throw new DistributionError(`PERCENTAGE rule missing percentageBps: ${rule.recipientId}`);
    }
    if (!Number.isInteger(rule.percentageBps) || rule.percentageBps < 1 || rule.percentageBps > 10_000) {
      throw new DistributionError(`percentageBps out of range 1..10000 for ${rule.recipientId}`);
    }
    bpsSum += rule.percentageBps;
  }
  if (bpsSum !== 10_000) {
    throw new DistributionError(`percentages must add to 10000 bps, got ${bpsSum}`);
  }

  if (optionalPolicy === "DROP_TO_PLATFORM" && dropped.length > 0) {
    // handled only when we had percentage of dropped — already dropped before pool; no-op here
    void input.platformRecipientId;
  }

  const shares = pctRules.map((rule) => {
    const bps = rule.percentageBps!;
    const floor = (pctPool * BigInt(bps)) / 10_000n;
    const remainderWeight = (pctPool * BigInt(bps)) % 10_000n;
    return {
      recipientId: rule.recipientId,
      role: rule.role,
      ruleKind: "PERCENTAGE" as const,
      priority: rule.priority,
      floor,
      remainderWeight,
    };
  });

  let pctEntries: CalculatedDistributionEntry[];
  if (rounding === "LARGEST_REMAINDER") {
    pctEntries = applyLargestRemainder(total.currency, pctPool, shares);
  } else {
    pctEntries = shares.map((s) => ({
      recipientId: s.recipientId,
      role: s.role,
      ruleKind: s.ruleKind,
      priority: s.priority,
      amount: money(total.currency, s.floor),
    }));
    const combined = [...fixedEntries, ...pctEntries];
    const sorted = sortEntries(combined);
    const adjustedPct = absorbRemainder(
      sorted.filter((e) => e.ruleKind === "PERCENTAGE"),
      money(total.currency, pctPool),
      rounding,
      input.platformRecipientId,
    );
    pctEntries = adjustedPct;
  }

  const entries = sortEntries([...fixedEntries, ...pctEntries]);
  const finalSum = sumMoney(
    entries.map((e) => e.amount),
    total.currency,
  );
  if (finalSum.amountMinor !== total.amountMinor) {
    if (rounding === "LARGEST_REMAINDER") {
      throw new DistributionError(
        `internal error: sum ${finalSum.amountMinor} !== total ${total.amountMinor}`,
      );
    }
    const fixedPart = fixedEntries;
    const pctPart = absorbRemainder(
      pctEntries,
      money(total.currency, pctPool),
      rounding,
      input.platformRecipientId,
    );
    const repaired = sortEntries([...fixedPart, ...pctPart]);
    const repairedSum = sumMoney(
      repaired.map((e) => e.amount),
      total.currency,
    );
    if (repairedSum.amountMinor !== total.amountMinor) {
      throw new DistributionError(
        `sum after absorb ${repairedSum.amountMinor} !== total ${total.amountMinor}`,
      );
    }
    return { total, entries: repaired, rounding, droppedRecipientIds: dropped };
  }

  return { total, entries, rounding, droppedRecipientIds: dropped };
}

function sortEntries(entries: CalculatedDistributionEntry[]): CalculatedDistributionEntry[] {
  return [...entries].sort((a, b) => a.priority - b.priority || a.recipientId.localeCompare(b.recipientId));
}
