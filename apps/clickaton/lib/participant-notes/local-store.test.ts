import assert from "node:assert/strict";
import test from "node:test";

import { combinarNotas, type NotasLocales } from "./local-store";

function local(over: Partial<NotasLocales[string]> & { promptId: string }) {
  return {
    body: "",
    solved: false,
    clientUpdatedAt: "2026-09-19T18:00:00.000Z",
    pending: false,
    ...over,
  };
}

test("lo que todavía no se sincronizó le gana a lo del servidor", () => {
  const r = combinarNotas({
    delServidor: [{ promptId: "p1", body: "vieja", solved: false }],
    delDispositivo: { p1: local({ promptId: "p1", body: "recién escrita", pending: true }) },
  });
  assert.equal(r.p1?.body, "recién escrita");
  assert.equal(r.p1?.pending, true);
});

test("si el dispositivo ya sincronizó, manda el servidor", () => {
  const r = combinarNotas({
    delServidor: [{ promptId: "p1", body: "escrita en la compu", solved: true }],
    delDispositivo: { p1: local({ promptId: "p1", body: "vieja del teléfono" }) },
  });
  assert.equal(r.p1?.body, "escrita en la compu");
  assert.equal(r.p1?.solved, true);
});

test("una nota que solo existe en el dispositivo no se pierde", () => {
  const r = combinarNotas({
    delServidor: [],
    delDispositivo: { p9: local({ promptId: "p9", body: "sin señal todavía", pending: true }) },
  });
  assert.equal(r.p9?.body, "sin señal todavía");
});

test("una nota que solo existe en el servidor aparece", () => {
  const r = combinarNotas({
    delServidor: [{ promptId: "p2", body: "de otro dispositivo", solved: false }],
    delDispositivo: {},
  });
  assert.equal(r.p2?.body, "de otro dispositivo");
  assert.equal(r.p2?.pending, false);
});
