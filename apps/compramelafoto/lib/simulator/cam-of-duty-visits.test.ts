import assert from "node:assert/strict";
import { test } from "node:test";

import { VISIT_GAP_MS, accountBornInCamOfDuty, camOfDutyAccessUrl, camOfDutyGate, camOfDutySignupUrl, isNewVisit } from "./cam-of-duty-visits";

test("recargar la página no suma otra entrada; volver después de media hora, sí", () => {
  const last = new Date("2026-10-23T18:00:00-03:00");
  assert.equal(isNewVisit(last, new Date(last.getTime() + 5 * 60 * 1000)), false);
  assert.equal(isNewVisit(last, new Date(last.getTime() + VISIT_GAP_MS)), true);
});

test("sin cuenta va a ingresar (estética Cam Of Duty) y vuelve a la misma página", () => {
  assert.equal(camOfDutySignupUrl("/camofduty/simulador"), "/camofduty/ingresar?redirect=%2Fcamofduty%2Fsimulador");
  assert.equal(camOfDutyAccessUrl("verify", "/camofduty/estudio"), "/camofduty/verificar?redirect=%2Fcamofduty%2Festudio");
});

test("sólo entran fotógrafos con el email validado y los datos completos", () => {
  const verified = new Date();
  assert.equal(camOfDutyGate({ role: "CUSTOMER", emailVerifiedAt: verified, profileComplete: true }), "not-photographer");
  assert.equal(camOfDutyGate({ role: "PHOTOGRAPHER", emailVerifiedAt: null, profileComplete: true }), "verify");
  assert.equal(camOfDutyGate({ role: "PHOTOGRAPHER", emailVerifiedAt: verified, profileComplete: false }), "complete");
  assert.equal(camOfDutyGate({ role: "PHOTOGRAPHER", emailVerifiedAt: verified, profileComplete: true }), "ok");
  // El administrador entra aunque no tenga datos de fotógrafo.
  assert.equal(camOfDutyGate({ role: "CUSTOMER", globalRole: "SUPER_ADMIN", emailVerifiedAt: verified, profileComplete: false }), "ok");
});

test("origen: la cuenta creada poco antes de la primera entrada nació en Cam Of Duty", () => {
  const first = new Date("2026-10-25T12:00:00Z");
  assert.equal(accountBornInCamOfDuty(new Date("2026-10-25T11:55:00Z"), first), true);
  assert.equal(accountBornInCamOfDuty(new Date("2026-03-01T10:00:00Z"), first), false);
});
