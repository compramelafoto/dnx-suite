import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { money } from "../../money/index.js";
import {
  moneyToMercadoPagoAmount,
  percentageBpsToMercadoPagoAmount,
} from "./money-mapper.js";

describe("moneyToMercadoPagoAmount", () => {
  it("serializes ARS without float", () => {
    assert.equal(moneyToMercadoPagoAmount(money("ARS", 350_00n)), "350.00");
    assert.equal(moneyToMercadoPagoAmount(money("ARS", 1n)), "0.01");
  });

  it("serializes CLP with scale 0", () => {
    assert.equal(moneyToMercadoPagoAmount(money("CLP", 1500n)), "1500");
  });

  it("rejects unknown currency scale", () => {
    assert.throws(() =>
      moneyToMercadoPagoAmount({ currency: "XXX" as "ARS", amountMinor: 1n }),
    );
  });
});

describe("percentageBpsToMercadoPagoAmount", () => {
  it("maps 1500 bps to 15.00 percent string", () => {
    assert.equal(percentageBpsToMercadoPagoAmount(1500), "15.00");
  });

  it("maps 10000 bps to 100.00", () => {
    assert.equal(percentageBpsToMercadoPagoAmount(10_000), "100.00");
  });

  it("rejects out of range bps", () => {
    assert.throws(() => percentageBpsToMercadoPagoAmount(10_001));
  });
});
