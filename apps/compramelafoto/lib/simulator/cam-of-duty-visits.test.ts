import assert from "node:assert/strict";
import { test } from "node:test";

import { VISIT_GAP_MS, camOfDutySignupUrl, isNewVisit } from "./cam-of-duty-visits";

test("recargar la página no suma otra entrada; volver después de media hora, sí", () => {
  const last = new Date("2026-10-23T18:00:00-03:00");
  assert.equal(isNewVisit(last, new Date(last.getTime() + 5 * 60 * 1000)), false);
  assert.equal(isNewVisit(last, new Date(last.getTime() + VISIT_GAP_MS)), true);
});

test("sin cuenta va al registro y vuelve a la misma página", () => {
  assert.equal(camOfDutySignupUrl("/camofduty/simulador"), "/registro?redirect=%2Fcamofduty%2Fsimulador");
});
