import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBps,
  computeEditionResult,
  parsePercentToBps,
  parsePesosToMinor,
} from "./result";

const income = {
  grossCollectedMinor: 741_000_00,
  refundedMinor: 0,
  paidRegistrations: 25,
  freeRegistrations: 5,
};

describe("computeEditionResult", () => {
  it("descuenta comisión y retiro en cascada, y los gastos", () => {
    const r = computeEditionResult({
      income,
      fees: { mpProcessingFeeBps: 761, mpWithdrawalFeeBps: 100, mpFeesActualMinor: null },
      expenses: [
        { amountMinor: 230_000_00, category: "OTRO", paidBy: "Tammy", isEstimate: false },
        { amountMinor: 44_000_00, category: "PUBLICIDAD", paidBy: "Dani", isEstimate: true },
      ],
      leftovers: [],
      receivedFromOtherEditions: [],
    });
    const processing = applyBps(741_000_00, 761);
    const withdrawal = applyBps(741_000_00 - processing, 100);
    assert.equal(r.mpProcessingFeeMinor, processing);
    assert.equal(r.mpWithdrawalFeeMinor, withdrawal);
    assert.equal(r.cashResultMinor, 741_000_00 - processing - withdrawal - 274_000_00);
    assert.equal(r.expensesEstimatedCount, 1);
    assert.equal(r.expensesByPayer[0]?.paidBy, "Tammy");
  });

  it("el monto real de MP manda sobre los porcentajes", () => {
    const r = computeEditionResult({
      income,
      fees: { mpProcessingFeeBps: 761, mpWithdrawalFeeBps: 100, mpFeesActualMinor: 50_000_00 },
      expenses: [],
      leftovers: [],
      receivedFromOtherEditions: [],
    });
    assert.equal(r.mpFeesSource, "actual");
    assert.equal(r.mpFeesTotalMinor, 50_000_00);
    assert.equal(r.netAfterFeesMinor, 691_000_00);
  });

  it("avisa cuando faltan las comisiones", () => {
    const r = computeEditionResult({
      income,
      fees: null,
      expenses: [],
      leftovers: [],
      receivedFromOtherEditions: [],
    });
    assert.equal(r.mpFeesSource, "missing");
    assert.equal(r.mpFeesTotalMinor, 0);
    assert.ok(r.warnings.some((w) => w.includes("comisiones")));
  });

  it("el sobrante suma al resultado económico y lo recibido resta", () => {
    const r = computeEditionResult({
      income: { ...income, grossCollectedMinor: 0 },
      fees: null,
      expenses: [{ amountMinor: 250_000_00, category: "MERCHANDISING", paidBy: "Rodri", isEstimate: false }],
      leftovers: [
        { quantity: 10, unitCostMinor: 8_000_00 },
        { quantity: 3, unitCostMinor: null },
      ],
      receivedFromOtherEditions: [{ quantity: 2, unitCostMinor: 1_000_00 }],
    });
    assert.equal(r.cashResultMinor, -250_000_00);
    assert.equal(r.leftoverValueMinor, 80_000_00);
    assert.equal(r.leftoverUnits, 13);
    assert.equal(r.leftoverWithoutCost, 1);
    assert.equal(r.economicResultMinor, -250_000_00 + 80_000_00 - 2_000_00);
  });

  it("los reembolsos bajan lo cobrado", () => {
    const r = computeEditionResult({
      income: { ...income, refundedMinor: 100_000_00 },
      fees: null,
      expenses: [],
      leftovers: [],
      receivedFromOtherEditions: [],
    });
    assert.equal(r.netCollectedMinor, 641_000_00);
  });
});

describe("parsePesosToMinor", () => {
  it("entiende cómo se escriben los pesos", () => {
    assert.equal(parsePesosToMinor("230.000"), 230_000_00);
    assert.equal(parsePesosToMinor("$ 44.000"), 44_000_00);
    assert.equal(parsePesosToMinor("250000"), 250_000_00);
    assert.equal(parsePesosToMinor("1.500,50"), 1_500_50);
    assert.equal(parsePesosToMinor("99.5"), 99_50);
    assert.equal(parsePesosToMinor(""), null);
    assert.throws(() => parsePesosToMinor("abc"));
    assert.throws(() => parsePesosToMinor("-5"));
  });
});

describe("parsePercentToBps", () => {
  it("acepta coma, punto y el signo %", () => {
    assert.equal(parsePercentToBps("7,61"), 761);
    assert.equal(parsePercentToBps("7.61 %"), 761);
    assert.equal(parsePercentToBps("0"), 0);
    assert.equal(parsePercentToBps(""), null);
    assert.throws(() => parsePercentToBps("150"));
    assert.throws(() => parsePercentToBps("-1"));
  });
});
