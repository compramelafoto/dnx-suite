import { test } from "node:test";
import assert from "node:assert/strict";
import { isVerifiedPhotographer } from "./verificado";

const aprobada = { status: "APPROVED", reverifyRequiredAt: null };

test("aprobado y fotógrafo: verificado", () => {
  assert.equal(isVerifiedPhotographer({ role: "PHOTOGRAPHER" }, aprobada), true);
});
test("aprobado pero con otro rol: no", () => {
  assert.equal(isVerifiedPhotographer({ role: "CUSTOMER" }, aprobada), false);
});
test("aprobado con reverificación pendiente: no", () => {
  assert.equal(
    isVerifiedPhotographer({ role: "PHOTOGRAPHER" }, { status: "APPROVED", reverifyRequiredAt: new Date() }),
    false,
  );
});
test("en revisión: no", () => {
  assert.equal(isVerifiedPhotographer({ role: "PHOTOGRAPHER" }, { status: "IN_REVIEW", reverifyRequiredAt: null }), false);
});
test("sin identidad: no", () => {
  assert.equal(isVerifiedPhotographer({ role: "PHOTOGRAPHER" }, null), false);
});
