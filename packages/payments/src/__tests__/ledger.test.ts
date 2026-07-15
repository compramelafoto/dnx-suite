import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppendOnlyLedger, createLedgerEntry, LedgerError } from "../ledger/index.js";

describe("Ledger append-only", () => {
  it("accepts balanced journals", () => {
    const entry = createLedgerEntry({
      id: "le1",
      journalId: "j1",
      currency: "ARS",
      legs: [
        { accountId: "clearing", amountMinor: 1000n },
        { accountId: "liability.photo", amountMinor: -700n },
        { accountId: "liability.platform", amountMinor: -300n },
      ],
      causeType: "PaymentApproved",
      causeId: "order-1",
      purpose: "capture",
      postedAt: "2026-07-15T00:00:00Z",
    });
    assert.equal(entry.legs.length, 3);
  });

  it("rejects unbalanced journals", () => {
    assert.throws(
      () =>
        createLedgerEntry({
          id: "le2",
          journalId: "j2",
          currency: "ARS",
          legs: [
            { accountId: "a", amountMinor: 100n },
            { accountId: "b", amountMinor: -50n },
          ],
          causeType: "PaymentApproved",
          causeId: "x",
          purpose: "capture",
          postedAt: "2026-07-15T00:00:00Z",
        }),
      LedgerError,
    );
  });

  it("forbids update and delete", () => {
    const ledger = new AppendOnlyLedger();
    ledger.append(
      createLedgerEntry({
        id: "le3",
        journalId: "j3",
        currency: "ARS",
        legs: [
          { accountId: "a", amountMinor: 100n },
          { accountId: "b", amountMinor: -100n },
        ],
        causeType: "PaymentApproved",
        causeId: "order-2",
        purpose: "capture",
        postedAt: "2026-07-15T00:00:00Z",
      }),
    );
    assert.throws(() => ledger.update("le3", {}), LedgerError);
    assert.throws(() => ledger.delete("le3"), LedgerError);
    assert.equal(ledger.balanceForAccount("a"), 100n);
  });

  it("rejects duplicate cause postings", () => {
    const ledger = new AppendOnlyLedger();
    const entry = createLedgerEntry({
      id: "le4",
      journalId: "j4",
      currency: "ARS",
      legs: [
        { accountId: "a", amountMinor: 10n },
        { accountId: "b", amountMinor: -10n },
      ],
      causeType: "PaymentApproved",
      causeId: "order-3",
      purpose: "capture",
      postedAt: "2026-07-15T00:00:00Z",
    });
    ledger.append(entry);
    assert.throws(() => ledger.append({ ...entry, id: "le5" }), LedgerError);
  });
});
