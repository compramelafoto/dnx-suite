import { test } from "node:test";
import assert from "node:assert/strict";
import { parseErApiRates, pickRate, localStoredToUsdCentsCeil, isStale, argentinaDate } from "./fx";

test("lee las cotizaciones y descarta las inválidas", () => {
  assert.deepEqual(
    parseErApiRates({ result: "success", rates: { COP: 3950.5, MXN: 18.2, CLP: -1 } }, ["COP", "MXN", "CLP", "PEN"]),
    { COP: 3950.5, MXN: 18.2 },
  );
  assert.deepEqual(parseErApiRates({ result: "error" }, ["COP"]), {});
  assert.deepEqual(parseErApiRates(null, ["COP"]), {});
});
test("elige compra o venta", () => {
  const r = { unitsPerUsdBuy: "4000", unitsPerUsdSell: "4100" };
  assert.equal(pickRate(r, "BUY"), 4000);
  assert.equal(pickRate(r, "SELL"), 4100);
});
test("pasa a centavos de USD redondeando hacia arriba", () => {
  assert.equal(localStoredToUsdCentsCeil(150000, "COP", 4000), 38);
  assert.equal(localStoredToUsdCentsCeil(1500, "CLP", 950), 158);
  assert.equal(localStoredToUsdCentsCeil(0, "COP", 4000), 0);
});
test("vieja a partir de 48 h", () => {
  const now = new Date("2026-11-14T10:00:00Z");
  assert.equal(isStale(new Date("2026-11-12T09:00:00Z"), now), true);
  assert.equal(isStale(new Date("2026-11-12T11:00:00Z"), now), false);
});
test("fecha argentina", () => {
  assert.equal(argentinaDate(new Date("2026-11-14T02:00:00Z")), "2026-11-13");
  assert.equal(argentinaDate(new Date("2026-11-14T04:00:00Z")), "2026-11-14");
});
