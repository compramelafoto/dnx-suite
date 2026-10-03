import { test } from "node:test";
import assert from "node:assert/strict";
import { decideCustomerToPhotographer } from "./customer-to-photographer";

test("un cliente sin compras puede pasar a fotógrafo", () => {
  assert.deepEqual(decideCustomerToPhotographer({ role: "CUSTOMER", purchaseCount: 0 }), {
    ok: true,
  });
});

test("un cliente con compras tiene que pasar por soporte", () => {
  const decision = decideCustomerToPhotographer({ role: "CUSTOMER", purchaseCount: 1 });
  assert.equal(decision.ok, false);
  assert.equal(decision.ok === false && decision.reason, "HAS_PURCHASES");
});

test("otros perfiles no pueden usar el cambio", () => {
  for (const role of ["PHOTOGRAPHER", "ADMIN", "LAB", "ORGANIZER"]) {
    const decision = decideCustomerToPhotographer({ role, purchaseCount: 0 });
    assert.equal(decision.ok === false && decision.reason, "NOT_CUSTOMER");
  }
});
