import { test } from "node:test";
import assert from "node:assert/strict";
import { Role } from "@prisma/client";
import {
  decideLabSessionAccess,
  effectivePhotographerIdForStatusChange,
} from "./session-lab-access";

test("sin sesión: 401", () => {
  assert.deepEqual(decideLabSessionAccess(null, { id: 1 }), {
    ok: false,
    status: 401,
    error: "No autenticado",
  });
});

test("roles que no son de laboratorio: 403", () => {
  for (const role of [Role.CUSTOMER, Role.PHOTOGRAPHER, Role.ADMIN, Role.ORGANIZER]) {
    const d = decideLabSessionAccess({ id: 5, role }, { id: 1 });
    assert.equal(d.ok, false);
    assert.equal(!d.ok && d.status, 403);
  }
});

test("laboratorio sin Lab asociado: 404", () => {
  const d = decideLabSessionAccess({ id: 5, role: Role.LAB }, null);
  assert.equal(!d.ok && d.status, 404);
});

test("LAB y LAB_PHOTOGRAPHER usan el laboratorio de la sesión", () => {
  assert.deepEqual(decideLabSessionAccess({ id: 5, role: Role.LAB }, { id: 42 }), {
    ok: true,
    labId: 42,
  });
  assert.deepEqual(
    decideLabSessionAccess({ id: 6, role: Role.LAB_PHOTOGRAPHER }, { id: 7 }),
    { ok: true, labId: 7 },
  );
});

test("el fotógrafo del cambio de estado es siempre el de la sesión", () => {
  assert.equal(effectivePhotographerIdForStatusChange({ id: 99 }), 99);
});
