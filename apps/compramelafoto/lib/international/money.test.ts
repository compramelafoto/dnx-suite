import test from "node:test";
import assert from "node:assert/strict";
import { formatMoney, storedToMajor, majorToStored } from "./money";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";

test("ARS idéntico al formateador actual", () => {
  for (const n of [0, 1, 1500, 12999, 1000000]) assert.equal(formatMoney(n, "ARS"), formatPurchaseArs(n));
});
test("centavos en USD y MXN", () => {
  assert.equal(storedToMajor(250, "USD"), 2.5);
  assert.equal(majorToStored(2.5, "USD"), 250);
  assert.equal(formatMoney(250, "USD"), new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(2.5));
  assert.equal(storedToMajor(50000, "MXN"), 500);
});
test("CLP sin decimales", () => {
  assert.equal(storedToMajor(5000, "CLP"), 5000);
  assert.equal(majorToStored(4999.6, "CLP"), 5000);
});
