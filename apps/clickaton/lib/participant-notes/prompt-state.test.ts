import assert from "node:assert/strict";
import test from "node:test";

import {
  estaEnviada,
  estaResuelta,
  estaSinConfirmar,
  resolverEstadoConsigna,
} from "./prompt-state";

test("una foto confirmada está enviada", () => {
  const e = resolverEstadoConsigna({ submissionStatus: "CONFIRMED" });
  assert.equal(e, "ENVIADA");
  assert.equal(estaEnviada(e), true);
  assert.equal(estaResuelta(e), true);
});

test("una foto subida sin confirmar no cuenta como enviada", () => {
  for (const s of ["PENDING_CONFIRMATION", "UPLOAD_PENDING", "PROCESSING"]) {
    const e = resolverEstadoConsigna({ submissionStatus: s });
    assert.equal(e, "SIN_CONFIRMAR", s);
    assert.equal(estaSinConfirmar(e), true, s);
    assert.equal(estaEnviada(e), false, `${s} no puede contar como entregada`);
  }
});

test("marcar «Ya la tengo» sin subir cuenta como resuelta, no como enviada", () => {
  const e = resolverEstadoConsigna({ solved: true });
  assert.equal(e, "YA_LA_TENGO");
  assert.equal(estaResuelta(e), true);
  assert.equal(estaEnviada(e), false);
});

test("la foto manda sobre el check: subida sin confirmar aunque no esté marcada", () => {
  const e = resolverEstadoConsigna({ submissionStatus: "PENDING_CONFIRMATION", solved: false });
  assert.equal(e, "SIN_CONFIRMAR");
});

test("sin nada, pendiente", () => {
  const e = resolverEstadoConsigna({});
  assert.equal(e, "PENDIENTE");
  assert.equal(estaResuelta(e), false);
});

test("una entrega rechazada no cuenta como resuelta", () => {
  const e = resolverEstadoConsigna({ submissionStatus: "REJECTED" });
  assert.equal(e, "RECHAZADA");
  assert.equal(estaResuelta(e), false);
});
