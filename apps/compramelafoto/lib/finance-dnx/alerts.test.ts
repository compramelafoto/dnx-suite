import assert from "node:assert/strict";
import test from "node:test";

import { shouldNagAboutMissingExpenses } from "./alerts";

test("día 4 del mes: todavía no hay que reclamar gastos sin cargar", () => {
  assert.equal(shouldNagAboutMissingExpenses(4), false);
});

test("día 5 del mes: ya hay que reclamar gastos sin cargar", () => {
  assert.equal(shouldNagAboutMissingExpenses(5), true);
});

test("día 1 del mes: todavía no", () => {
  assert.equal(shouldNagAboutMissingExpenses(1), false);
});

test("día 31 del mes: sigue valiendo el reclamo", () => {
  assert.equal(shouldNagAboutMissingExpenses(31), true);
});
