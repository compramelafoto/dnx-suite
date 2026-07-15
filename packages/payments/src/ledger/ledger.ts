import type { CurrencyCode } from "../contracts/primitives.js";
import type { LedgerEntry, LedgerLeg } from "../contracts/entities.js";

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

export interface CreateLedgerEntryInput {
  id: string;
  journalId: string;
  currency: CurrencyCode;
  legs: LedgerLeg[];
  causeType: string;
  causeId: string;
  purpose: string;
  postedAt: string;
  metadata?: Record<string, string>;
}

/** Validate and freeze a ledger entry (append-only contract). */
export function createLedgerEntry(input: CreateLedgerEntryInput): Readonly<LedgerEntry> {
  if (input.legs.length < 2) {
    throw new LedgerError("journal requires at least 2 legs");
  }
  let sum = 0n;
  for (const leg of input.legs) {
    if (typeof leg.amountMinor !== "bigint") {
      throw new LedgerError("leg amountMinor must be bigint");
    }
    sum += leg.amountMinor;
  }
  if (sum !== 0n) {
    throw new LedgerError(`legs must sum to zero, got ${sum}`);
  }
  const entry: LedgerEntry = {
    id: input.id,
    journalId: input.journalId,
    currency: input.currency,
    legs: input.legs.map((l) => ({ accountId: l.accountId, amountMinor: l.amountMinor })),
    causeType: input.causeType,
    causeId: input.causeId,
    purpose: input.purpose,
    postedAt: input.postedAt,
    metadata: input.metadata ? { ...input.metadata } : undefined,
  };
  Object.freeze(entry.legs);
  if (entry.metadata) Object.freeze(entry.metadata);
  return Object.freeze(entry);
}

/**
 * Append-only store helper for in-memory / tests.
 * Rejects mutation and duplicate (causeType, causeId, purpose).
 */
export class AppendOnlyLedger {
  private readonly entries: LedgerEntry[] = [];
  private readonly keys = new Set<string>();

  append(entry: LedgerEntry): void {
    const key = `${entry.causeType}:${entry.causeId}:${entry.purpose}`;
    if (this.keys.has(key)) {
      throw new LedgerError(`duplicate ledger posting: ${key}`);
    }
    // Ensure balanced
    createLedgerEntry(entry);
    this.entries.push(entry);
    this.keys.add(key);
  }

  /** Explicitly forbidden — domain rule. */
  update(_id: string, _patch: Partial<LedgerEntry>): never {
    throw new LedgerError("ledger entries are immutable; post a compensating entry instead");
  }

  /** Explicitly forbidden — domain rule. */
  delete(_id: string): never {
    throw new LedgerError("ledger entries cannot be deleted");
  }

  list(): readonly LedgerEntry[] {
    return this.entries;
  }

  balanceForAccount(accountId: string): bigint {
    let bal = 0n;
    for (const e of this.entries) {
      for (const leg of e.legs) {
        if (leg.accountId === accountId) {
          bal += leg.amountMinor;
        }
      }
    }
    return bal;
  }
}
