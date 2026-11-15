import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeIntlDigitalTotals,
  canSellIntl,
  intlBlockMessage,
  shouldUseIntlFlow,
  buildIntlSnapshot,
  intlCollectorAllowed,
} from "./intl-order";

const ok = {
  pilot: true,
  mpConnected: true,
  mpCurrency: "COP",
  albumCurrency: "COP",
  balanceUsdCents: 2500,
  hasFx: true,
  allDigital: true,
  unitPriceStored: 1000000,
  inEvent: false,
};

test("10.000 COP + 15 % = 11.500 COP", () => {
  assert.deepEqual(computeIntlDigitalTotals({ unitPriceStored: 1000000, photoCount: 1, currency: "COP" }), {
    subtotalStored: 1000000,
    commissionStored: 150000,
    totalStored: 1150000,
  });
  assert.deepEqual(computeIntlDigitalTotals({ unitPriceStored: 999, photoCount: 3, currency: "MXN" }), {
    subtotalStored: 2997,
    commissionStored: 450,
    totalStored: 3447,
  });
});
test("puede vender con todo en orden", () => {
  assert.deepEqual(canSellIntl(ok), { ok: true });
});
test("bloqueos", () => {
  assert.deepEqual(canSellIntl({ ...ok, pilot: false }), { ok: false, block: "NOT_PILOT" });
  assert.deepEqual(canSellIntl({ ...ok, mpConnected: false }), { ok: false, block: "NO_MP" });
  assert.deepEqual(canSellIntl({ ...ok, mpCurrency: "MXN" }), { ok: false, block: "MP_COUNTRY_MISMATCH" });
  assert.deepEqual(canSellIntl({ ...ok, mpCurrency: null }), { ok: false, block: "MP_COUNTRY_MISMATCH" });
  assert.deepEqual(canSellIntl({ ...ok, balanceUsdCents: 0 }), { ok: false, block: "NO_BALANCE" });
  assert.deepEqual(canSellIntl({ ...ok, hasFx: false }), { ok: false, block: "NO_FX" });
  assert.deepEqual(canSellIntl({ ...ok, allDigital: false }), { ok: false, block: "NOT_DIGITAL_ONLY" });
  assert.deepEqual(canSellIntl({ ...ok, unitPriceStored: null }), { ok: false, block: "NO_PRICE" });
  assert.deepEqual(canSellIntl({ ...ok, unitPriceStored: 0 }), { ok: false, block: "NO_PRICE" });
});
test("el cliente nunca ve el motivo interno", () => {
  assert.equal(intlBlockMessage("NO_BALANCE"), intlBlockMessage("NOT_PILOT"));
  assert.match(intlBlockMessage("NO_FX"), /pausada momentáneamente/);
});
test("un álbum en ARS siempre va por el circuito argentino (Review Focus 5)", () => {
  assert.equal(shouldUseIntlFlow("ARS"), false);
  assert.equal(shouldUseIntlFlow(""), false);
  assert.equal(shouldUseIntlFlow("COP"), true);
});
test("snapshot del pedido", () => {
  assert.deepEqual(buildIntlSnapshot({ currency: "COP", subtotalStored: 10, commissionStored: 2 }), {
    intlV1: { commissionPercent: 15, subtotalStored: 10, commissionStored: 2, currency: "COP" },
  });
});

test("COP y CLP: el total queda en unidades enteras para Mercado Pago (revisión final 5)", () => {
  // 3.333 COP + 15 % = 3.832,95 → comisión redondeada a pesos enteros: 500 → total 3.833 COP.
  assert.deepEqual(computeIntlDigitalTotals({ unitPriceStored: 333300, photoCount: 1, currency: "COP" }), {
    subtotalStored: 333300,
    commissionStored: 50000,
    totalStored: 383300,
  });
  assert.deepEqual(computeIntlDigitalTotals({ unitPriceStored: 3333, photoCount: 1, currency: "CLP" }), {
    subtotalStored: 3333,
    commissionStored: 500,
    totalStored: 3833,
  });
});
test("álbum de evento: no se vende en el piloto (revisión final 3)", () => {
  assert.deepEqual(canSellIntl({ ...ok, inEvent: true }), { ok: false, block: "EVENT_ALBUM" });
});
test("el cobro tiene que ir a la cuenta del fotógrafo", () => {
  assert.equal(intlCollectorAllowed("PHOTOGRAPHER"), true);
  assert.equal(intlCollectorAllowed("ORGANIZER"), false);
});
