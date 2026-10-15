import test from "node:test";
import assert from "node:assert/strict";

import { puedeAdmitirse } from "./puede-admitirse";

test("una obra elegible se admite", () => {
  assert.deepEqual(puedeAdmitirse({ status: "ELIGIBLE", eligible: true }), { ok: true });
});

/**
 * El círculo vicioso: para admitir había que resolver la revisión manual, y
 * resolverla admitiendo era justo lo que el motor no dejaba hacer. Con eso,
 * el botón de admitir de la cola de revisión no habría funcionado nunca.
 */
test("la revisión manual se puede resolver admitiendo", () => {
  assert.deepEqual(
    puedeAdmitirse({
      status: "PENDING_MANUAL_REVIEW",
      eligible: false,
      resolviendoRevisionManual: true,
    }),
    { ok: true },
  );
});

test("sin resolver la revisión manual, no se admite sola", () => {
  assert.deepEqual(puedeAdmitirse({ status: "PENDING_MANUAL_REVIEW", eligible: false }), {
    ok: false,
    error: "MANUAL_REVIEW_REQUIRED",
  });
});

test("una obra con motivos bloqueantes no se admite ni resolviendo a mano", () => {
  for (const resolviendoRevisionManual of [true, false]) {
    assert.deepEqual(
      puedeAdmitirse({ status: "REJECTED", eligible: false, resolviendoRevisionManual }),
      { ok: false, error: "NOT_ELIGIBLE" },
      "una obra rechazada por el motor no entra por la puerta de la revisión manual",
    );
  }
});

test("retirada o reemplazada tampoco entra", () => {
  for (const status of ["WITHDRAWN", "REPLACED", "EXCLUDED"] as const) {
    assert.deepEqual(
      puedeAdmitirse({ status, eligible: false, resolviendoRevisionManual: true }),
      { ok: false, error: "NOT_ELIGIBLE" },
      `${status} no se admite`,
    );
  }
});
