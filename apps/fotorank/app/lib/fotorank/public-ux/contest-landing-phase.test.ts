import { test } from "node:test";
import assert from "node:assert/strict";
import { finalCtaCopy, getLandingPhase, phaseCta } from "./contest-landing-phase";

// Santa Fe en Foco al 19/11/2026: inscripción cerrada el 1/11, carga reabierta hasta el 1/12
// y la fecha de inicio de evaluación guardada (1/11) ya pasó.
const sfef = {
  status: "PUBLISHED",
  startAt: new Date("2026-08-01T03:00:00Z"),
  registrationClosesAt: new Date("2026-11-01T03:00:00Z"),
  submissionDeadline: new Date("2026-12-02T03:00:00Z"),
  judgingStartAt: new Date("2026-11-01T15:00:00Z"),
  resultsAt: new Date("2026-12-10T15:00:00Z"),
};

test("con la carga reabierta para inscriptos no dice 'En evaluación' ni ofrece inscribirse", () => {
  const phase = getLandingPhase({ ...sfef, now: Date.parse("2026-11-19T20:00:00Z") });
  assert.equal(phase, "uploads-only");
  assert.deepEqual(phaseCta(phase), { primary: "Cargar mi foto", enabled: true, tone: "primary" });
  assert.match(finalCtaCopy(phase, "1 de diciembre de 2026, 23:59 h").body, /hasta el 1 de diciembre/);
});

test("al vencer la carga vuelve a la evaluación", () => {
  assert.equal(getLandingPhase({ ...sfef, now: Date.parse("2026-12-02T04:00:00Z") }), "in-evaluation");
});

test("mientras la inscripción está abierta sigue ofreciendo inscribirse", () => {
  assert.equal(getLandingPhase({ ...sfef, now: Date.parse("2026-10-10T12:00:00Z") }), "open");
});

test("sin cierre de inscripción propio el comportamiento no cambia", () => {
  const { registrationClosesAt: _omit, ...sinCierre } = sfef;
  assert.equal(getLandingPhase({ ...sinCierre, now: Date.parse("2026-11-19T20:00:00Z") }), "in-evaluation");
});
