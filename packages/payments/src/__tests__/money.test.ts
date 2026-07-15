import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  money,
  addMoney,
  subtractMoney,
  shareByBps,
  MoneyError,
  percentageFromBps,
} from "../money/index.js";

describe("Money value object", () => {
  it("rejects float minor units", () => {
    assert.throws(() => money("ARS", 10.5), MoneyError);
  });

  it("adds and subtracts same currency", () => {
    const a = money("ARS", 1000);
    const b = money("ARS", 250);
    assert.equal(addMoney(a, b).amountMinor, 1250n);
    assert.equal(subtractMoney(a, b).amountMinor, 750n);
  });

  it("rejects currency mismatch", () => {
    assert.throws(() => addMoney(money("ARS", 1), money("USD", 1)), MoneyError);
  });

  it("computes percentage share in integer math", () => {
    const total = money("ARS", 1000);
    assert.equal(shareByBps(total, 1500).amountMinor, 150n);
    assert.equal(percentageFromBps(10000).bps, 10_000);
  });

  it("rejects bps out of range", () => {
    assert.throws(() => percentageFromBps(10001), MoneyError);
  });
});
