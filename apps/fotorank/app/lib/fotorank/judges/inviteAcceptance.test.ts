/**
 * Un jurado invitado ANTES de que le asignen una categoría tenía que poder
 * registrarse igual. Antes fallaba con un mensaje que nombraba los estados
 * ASSIGNED e INVITATION_SENT, que no significan nada para quien lo lee.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { resultadoDeAceptarInvitacion } from "./inviteAcceptance";

test("con asignaciones pendientes, se aceptan", () => {
  const r = resultadoDeAceptarInvitacion({ pendingAssignmentsCount: 2 });
  assert.equal(r.aceptaInvitacion, true);
  assert.equal(r.aceptaAsignaciones, true);
  assert.equal(r.aviso, null);
});

test("sin asignaciones pendientes, el alta se completa igual", () => {
  const r = resultadoDeAceptarInvitacion({ pendingAssignmentsCount: 0 });
  assert.equal(r.aceptaInvitacion, true);
  assert.equal(r.aceptaAsignaciones, false);
  assert.equal(
    r.aviso,
    "Todavía no te asignaron ninguna categoría. Escribile al organizador del concurso.",
  );
});

test("el aviso no nombra estados de la base", () => {
  const r = resultadoDeAceptarInvitacion({ pendingAssignmentsCount: 0 });
  assert.ok(r.aviso);
  for (const palabra of ["ASSIGNED", "INVITATION_SENT", "ACCEPTED", "null"]) {
    assert.ok(!r.aviso.includes(palabra), `el aviso no debe nombrar ${palabra}`);
  }
});
